#!/bin/bash
gcloud config set project raga-mitra

for i in {0..49}
do
  gcloud compute addresses create ragamitramdbep-ip-"$i" \
    --region=asia-south1 \
    --subnet=default
done

for i in {0..49}
do
  if [ "$(gcloud compute addresses describe ragamitramdbep-ip-"$i" --region=asia-south1 --format="value(status)")" != "RESERVED" ]; then
    echo "ragamitramdbep-ip-$i is not RESERVED";
    exit 1;
  fi
done

for i in {0..49}
do
  gcloud compute forwarding-rules create ragamitramdbep-"$i" \
    --region=asia-south1 \
    --network=default \
    --address=ragamitramdbep-ip-"$i" \
    --allow-psc-global-access \
    --target-service-attachment=projects/p-zastxwc65hzzlqo9n1hl7ghl/regions/asia-south1/serviceAttachments/sa-asia-south1-68cfa80879fd6f1960aaef08-"$i"
done

if [ "$(gcloud compute forwarding-rules list --regions=asia-south1 --format="csv[no-heading](name)" --filter="(name:ragamitramdbep*)" | wc -l)" -gt 50 ]; then
  echo "Project has too many forwarding rules that match prefix ragamitramdbep. Either delete the competing resources or choose another endpoint prefix."
  exit 2;
fi

gcloud compute forwarding-rules list --regions=asia-south1 --format="json(IPAddress,name)" --filter="name:(ragamitramdbep*)" > atlasEndpoints-ragamitramdbep.json

