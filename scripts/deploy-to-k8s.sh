#!/bin/bash
set -e

script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

acr_login_server=$(jq -r '.acr_login_server' < "$script_dir/../infra/output.json")
if [[ ${#acr_login_server} -eq 0 ]]; then
  echo 'ERROR: Missing output value acr_login_server' 1>&2
  exit 6
fi

service_bus_namespace_qualified_name=$(jq -r '.service_bus_namespace_qualified_name' < "$script_dir/../infra/output.json")
if [[ ${#service_bus_namespace_qualified_name} -eq 0 ]]; then
  echo 'ERROR: Missing output value service_bus_namespace_qualified_name' 1>&2
  exit 6
fi

handler_type=$SUBSCRIBER_HANDLER_TYPE
if [[ ${#handler_type} -eq 0 ]]; then
  handler_type=SIMPLE
  echo "### SUBSCRIBER_HANDLER_TYPE not set, using default $handler_type"
else
  echo "### Using handler type $handler_type"
fi


echo "### Deploying components.k8s"
kubectl apply -f "$script_dir/../components.k8s"

echo "### Deploying processing-service"
cat "$script_dir/../src/processing-service/deploy.yaml" \
  | REGISTRY_NAME=$acr_login_server envsubst \
  | kubectl apply -f -

echo "### Deploying subscriber"
cat "$script_dir/../src/subscriber/deploy.yaml" \
  | REGISTRY_NAME=$acr_login_server SERVICE_BUS_NAMESPACE=$service_bus_namespace_qualified_name HANDLER_TYPE=$handler_type envsubst \
  | kubectl apply -f -
