#!/bin/bash
set -e

script_dir="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

acr_name=$(jq -r '.acr_name' < "$script_dir/../infra/output.json")
if [[ ${#acr_name} -eq 0 ]]; then
  echo 'ERROR: Missing output value acr_name' 1>&2
  exit 6
fi

acr_login_server=$(jq -r '.acr_login_server' < "$script_dir/../infra/output.json")
if [[ ${#acr_login_server} -eq 0 ]]; then
  echo 'ERROR: Missing output value acr_login_server' 1>&2
  exit 6
fi

az acr login --name "$acr_name"

docker build -t "$acr_login_server/subscriber" src/subscriber
docker push "$acr_login_server/subscriber"

docker build -t "$acr_login_server/processing-service" src/processing-service
docker push "$acr_login_server/processing-service"

docker build -t "$acr_login_server/publisher" src/publisher
docker push "$acr_login_server/publisher"
