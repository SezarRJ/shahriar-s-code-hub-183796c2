#!/bin/bash

SUPABASE_URL=$(grep SUPABASE_URL .env | cut -d '=' -f2)
SUPABASE_KEY=$(grep SUPABASE_SERVICE_KEY .env | cut -d '=' -f2)
TENANT_ID="a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11"

users=(
  "admin@shahid.local:AdminPassword123!:System Administrator:super_admin"
  "ahmed@demo.shahid.local:AhmedPassword123!:Ahmed Manager:project_manager"
)

for user_data in "${users[@]}"; do
  IFS=':' read -r email password name role <<< "$user_data"
  echo "Creating auth user: $email..."
  
  RESPONSE=$(curl -s -X POST "$SUPABASE_URL/auth/v1/admin/users" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$email\",
      \"password\": \"$password\",
      \"email_confirm\": true,
      \"user_metadata\": { \"name\": \"$name\" }
    }")

  # Use sed to extract the ID more reliably
  USER_ID=$(echo "$RESPONSE" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')

  if [ -z "$USER_ID" ]; then
    if [[ $RESPONSE == *"email_exists"* ]]; then
      echo "User $email already exists in Auth. Attempting to retrieve ID..."
      # Fetch existing user ID
      USER_ID=$(curl -s -X GET "$SUPABASE_URL/auth/v1/admin/users" \
        -H "apikey: $SUPABASE_KEY" \
        -H "Authorization: Bearer $SUPABASE_KEY" | grep -B 1 "$email" | grep -o '"id":"[^"]*' | cut -d'"' -f4 | head -n 1)
    else
      echo "Error creating auth user $email: $RESPONSE"
      continue
    fi
  fi

  if [ -z "$USER_ID" ]; then
    echo "Could not find ID for $email."
    continue
  fi

  echo "Linking to app user record for $email (ID: $USER_ID)..."
  curl -s -X POST "$SUPABASE_URL/rest/v1/users" \
    -H "apikey: $SUPABASE_KEY" \
    -H "Authorization: Bearer $SUPABASE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "{
      \"auth_id\": \"$USER_ID\",
      \"email\": \"$email\",
      \"name\": \"$name\",
      \"role\": \"$role\",
      \"tenant_id\": \"$TENANT_ID\"
    }"
  
  echo -e "\nFinished processing $email"
done
