param location string = resourceGroup().location

@description('Resource name prefix')
param resourceNamePrefix string
var envResourceNamePrefix = toLower(resourceNamePrefix)

@description('Disk size (in GB) to provision for each of the agent pool nodes. Specifying 0 will apply the default disk size for that agentVMSize')
@minValue(0)
@maxValue(1023)
param aksDiskSizeGB int = 30

@description('The number of nodes for the AKS cluster')
@minValue(1)
@maxValue(50)
param aksNodeCount int = 1

@description('The size of the Virtual Machine nodes in the AKS cluster')
param aksVMSize string = 'Standard_B2s'
// param aksVMSize string = 'Standard_D2s_v3'

@description('The Service Bus SKU to use')
param serviceBusSku string = 'Standard'

/////////////////////////////////////
// Container registry
//

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2022-02-01-preview' = {
  name: '${envResourceNamePrefix}registry'
  location: location
  sku: {
    name: 'Standard'
  }
}

/////////////////////////////////////
// AKS Cluster
//

resource aks 'Microsoft.ContainerService/managedClusters@2023-03-02-preview' = {
  name: '${envResourceNamePrefix}cluster'
  location: location
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    dnsPrefix: 'aks'
    agentPoolProfiles: [
      {
        name: 'agentpool'
        osDiskSizeGB: aksDiskSizeGB
        count: aksNodeCount
        minCount: 1
        maxCount: aksNodeCount
        vmSize: aksVMSize
        osType: 'Linux'
        mode: 'System'
        enableAutoScaling: true
      }
    ]
    oidcIssuerProfile: {
      enabled: true
    }
    securityProfile: {
      workloadIdentity: {
        enabled: true
      }
    }
  }
}

// Enable cluster to pull images from container registry
var roleAcrPullName = 'b24988ac-6180-42a0-ab88-20f7382dd24c'
resource contributorRoleDefinition 'Microsoft.Authorization/roleDefinitions@2018-01-01-preview' existing = {
  scope: subscription()
  name: roleAcrPullName

}
resource assignAcrPullToAks 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: guid(resourceGroup().id, containerRegistry.name, aks.name, 'AssignAcrPullToAks')
  scope: containerRegistry
  properties: {
    description: 'Assign AcrPull role to AKS'
    principalId: aks.properties.identityProfile.kubeletidentity.objectId
    principalType: 'ServicePrincipal'
    roleDefinitionId: contributorRoleDefinition.id
  }
}

/////////////////////////////////////
// Service bus namespace
//

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2021-11-01' = {
  name: '${envResourceNamePrefix}sb'
  location: location
  sku: {
    name: serviceBusSku
  }
  properties: {}
}


// https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#azure-service-bus-data-receiver
var roleServiceBusDataReceiverName = '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0'
resource roleServiceBusDataReceiver 'Microsoft.Authorization/roleDefinitions@2018-01-01-preview' existing = {
  scope: subscription()
  name: roleServiceBusDataReceiverName
}
var roleServiceBusDataSenderName = '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
resource roleServiceBusDataSender 'Microsoft.Authorization/roleDefinitions@2018-01-01-preview' existing = {
  scope: serviceBusNamespace
  name: '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39'
}

/////////////////////////////////////
//
// Task event topics

// task-created topic + subscriptions
resource ordersQueue 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = {
  parent: serviceBusNamespace
  name: 'orders'
  properties: {}
}

/////////////////////////////////////
// Application identities
//

// subscriber identity
resource subscriberIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2022-01-31-preview' = {
  name: '${resourceNamePrefix}-subscriber'
  location: location
}
resource subscriberFederatedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2022-01-31-preview' = {
  parent: subscriberIdentity
  name: '${resourceNamePrefix}-subscriber-federated-identity'
  properties: {
    issuer: aks.properties.oidcIssuerProfile.issuerURL
    subject: 'system:serviceaccount:default:subscriber' 
    audiences: [ 'api://AzureADTokenExchange' ]
  }
}

resource subscriberServiceBusReadOrdersQueue 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: guid(resourceGroup().id, ordersQueue.id, subscriberIdentity.id, roleServiceBusDataReceiver.id)
  scope: ordersQueue
  properties: {
    description: 'Assign ServiceBusDataReceiver role to subscriber for orders queue'
    principalId: subscriberIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: roleServiceBusDataReceiver.id
  }
}

// publisher identity
resource publisherIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2022-01-31-preview' = {
  name: '${resourceNamePrefix}-publisher'
  location: location
}
resource publisherFederatedIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2022-01-31-preview' = {
  parent: publisherIdentity
  name: '${resourceNamePrefix}-publisher-federated-identity'
  properties: {
    issuer: aks.properties.oidcIssuerProfile.issuerURL
    subject: 'system:serviceaccount:default:publisher' 
    audiences: [ 'api://AzureADTokenExchange' ]
  }
}

resource publisherServiceBusSendOrdersQueue 'Microsoft.Authorization/roleAssignments@2020-04-01-preview' = {
  name: guid(resourceGroup().id, ordersQueue.id, publisherIdentity.id, roleServiceBusDataSender.id)
  scope: ordersQueue
  properties: {
    description: 'Assign ServiceBusDataSender role to publisher for orders queue'
    principalId: publisherIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: roleServiceBusDataReceiver.id
  }
}


output acr_name string = containerRegistry.name
output acr_login_server string = containerRegistry.properties.loginServer

output aks_name string = aks.name

output service_bus_namespace_name string = serviceBusNamespace.name
output service_bus_namespace_qualified_name string = replace(replace(serviceBusNamespace.properties.serviceBusEndpoint, 'https://', ''), ':443/', '')

output subscriber_client_id string = subscriberIdentity.properties.clientId
output subscriber_principal_id string = subscriberIdentity.properties.principalId

output publisher_client_id string = publisherIdentity.properties.clientId
output publisher_principal_id string = publisherIdentity.properties.principalId
