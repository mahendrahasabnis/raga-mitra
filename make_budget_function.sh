#!/bin/bash

# Function to create a budget for a Google Cloud project
make_budget() {
    local PROJECT_ID="$1"
    
    if [ -z "$PROJECT_ID" ]; then
        echo "Error: Project ID is required"
        echo "Usage: make_budget <project-id>"
        return 1
    fi
    
    echo "Creating budget for project: $PROJECT_ID"
    
    # Get the billing account ID
    BILLING_ACCOUNT=$(gcloud billing accounts list --format="value(name)" --limit=1)
    
    if [ -z "$BILLING_ACCOUNT" ]; then
        echo "Error: No billing account found"
        return 1
    fi
    
    echo "Using billing account: $BILLING_ACCOUNT"
    
    # Create a budget configuration
    cat > /tmp/budget-config.json << BUDGET_EOF
{
  "displayName": "Budget for $PROJECT_ID",
  "budgetFilter": {
    "projects": ["projects/$PROJECT_ID"]
  },
  "amount": {
    "specifiedAmount": {
      "currencyCode": "USD",
      "units": "100"
    }
  },
  "thresholdRules": [
    {
      "thresholdPercent": 0.5,
      "spendBasis": "CURRENT_SPEND"
    },
    {
      "thresholdPercent": 0.8,
      "spendBasis": "CURRENT_SPEND"
    },
    {
      "thresholdPercent": 0.95,
      "spendBasis": "CURRENT_SPEND"
    }
  ]
}
BUDGET_EOF
    
    # Create the budget
    gcloud billing budgets create \
        --billing-account="$BILLING_ACCOUNT" \
        --display-name="Budget for $PROJECT_ID" \
        --budget-amount=100USD \
        --filter-projects="projects/$PROJECT_ID" \
        --threshold-rule="basis=CURRENT_SPEND,percent=0.5" \
        --threshold-rule="basis=CURRENT_SPEND,percent=0.8" \
        --threshold-rule="basis=CURRENT_SPEND,percent=0.95"
    
    # Clean up
    rm -f /tmp/budget-config.json
    
    echo "Budget created successfully for $PROJECT_ID"
}
