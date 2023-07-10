#!/bin/bash
set -e

#
# This script expects to find an output.json in the infra folder with the values
# from the infrastructure deployment.
# It then creates the env files etc for each component
#

script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

output_file="$script_dir/../infra/output.json"

if [[ -f "$script_dir/../.env" ]]; then
	source "$script_dir/../.env"
fi

service_bus_namespace_name=$(jq -r '.service_bus_namespace_name' < "$output_file")
if [[ ${#service_bus_namespace_name} -eq 0 ]]; then
  echo 'ERROR: Missing output value service_bus_namespace_name' 1>&2
  exit 6
fi
service_bus_connection_string=$(az servicebus namespace authorization-rule keys list --resource-group $RESOURCE_GROUP --namespace-name $service_bus_namespace_name --name RootManageSharedAccessKey --query primaryConnectionString -o tsv)

service_bus_namespace_qualified_name=$(jq -r '.service_bus_namespace_qualified_name' < "$output_file")
if [[ ${#service_bus_namespace_qualified_name} -eq 0 ]]; then
  echo 'ERROR: Missing output value service_bus_namespace_qualified_name' 1>&2
  exit 6
fi

subscriber_client_id=$(jq -r '.subscriber_client_id' < "$output_file")
if [[ ${#subscriber_client_id} -eq 0 ]]; then
  echo 'ERROR: Missing output value subscriber_client_id' 1>&2
  exit 6
fi
publisher_client_id=$(jq -r '.publisher_client_id' < "$output_file")
if [[ ${#publisher_client_id} -eq 0 ]]; then
  echo 'ERROR: Missing output value publisher_client_id' 1>&2
  exit 6
fi

#create secret file with connection string for pubsub
cat <<EOF > "$script_dir/../components.k8s/pubsub.secret.yaml"
apiVersion: v1
data:
   namespaceName: $(echo -n "$service_bus_namespace_qualified_name" | base64 -w 0)
kind: Secret
metadata:
  name: servicebus-pubsub-secret
  namespace: default
type: Opaque
EOF
echo "CREATED: k8s secret file"



cat <<EOF > "$script_dir/../src/publisher/secrets.json"
{
  "SERVICE_BUS_CONNECTION_STRING": "$service_bus_connection_string"
}
EOF
echo "CREATED: local secret file for publisher"

cat <<EOF > "$script_dir/../src/publisher-console/.env"
SERVICE_BUS_CONNECTION_STRING=$service_bus_connection_string

EOF
echo "CREATED: .env file for publisher-console"


cat <<EOF > "$script_dir/../src/subscriber/secrets.json"
{
  "SERVICE_BUS_CONNECTION_STRING": "$service_bus_connection_string"
}
EOF
echo "CREATED: local secret file for subscriber"


service_account_namespace="default"
service_account_name="subscriber"
client_id=$subscriber_client_id
cat <<EOF > "$script_dir/../components.k8s/serviceaccount-${service_account_name}.secret.yaml"
apiVersion: v1
kind: ServiceAccount
metadata:
  annotations:
    azure.workload.identity/client-id: ${client_id}
  labels:
    azure.workload.identity/use: "true"
  name: ${service_account_name}
  namespace: ${service_account_namespace}
EOF
echo "CREATED: k8s service account file for $service_account_name"


service_account_namespace="default"
service_account_name="publisher"
client_id=$publisher_client_id
cat <<EOF > "$script_dir/../components.k8s/serviceaccount-${service_account_name}.secret.yaml"
apiVersion: v1
kind: ServiceAccount
metadata:
  annotations:
    azure.workload.identity/client-id: ${client_id}
  labels:
    azure.workload.identity/use: "true"
  name: ${service_account_name}
  namespace: ${service_account_namespace}
EOF
echo "CREATED: k8s service account file for $service_account_name"