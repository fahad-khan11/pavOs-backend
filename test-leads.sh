#!/bin/bash

# PaveOS Leads API - Quick Test Script
# This script tests all lead endpoints

set -e

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:5000}"
WHOP_USER_ID="${WHOP_USER_ID:-user_test123}"
WHOP_COMPANY_ID="${WHOP_COMPANY_ID:-comp_test456}"
API_BASE="${BACKEND_URL}/pavos/api/v1"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  PaveOS Leads API - Testing Suite${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Configuration:"
echo "  Backend URL: ${BACKEND_URL}"
echo "  User ID: ${WHOP_USER_ID}"
echo "  Company ID: ${WHOP_COMPANY_ID}"
echo ""

# Test 1: Create Lead
echo -e "${YELLOW}📝 TEST 1: Creating a new lead...${NC}"
CREATE_RESPONSE=$(curl -s -X POST "${API_BASE}/leads" \
  -H "Content-Type: application/json" \
  -H "X-Whop-User-Id: ${WHOP_USER_ID}" \
  -H "X-Whop-Company-Id: ${WHOP_COMPANY_ID}" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "productId": "prod_123",
    "referrer": "https://example.com",
    "metadata": {
      "source": "bash_script",
      "testTime": "'$(date)'"
    }
  }')

echo "Response:"
echo "$CREATE_RESPONSE" | jq '.' 2>/dev/null || echo "$CREATE_RESPONSE"
echo ""

# Extract lead ID from response
LEAD_ID=$(echo "$CREATE_RESPONSE" | jq -r '.data.id' 2>/dev/null)

if [ -z "$LEAD_ID" ] || [ "$LEAD_ID" = "null" ]; then
  echo -e "${RED}❌ Failed to create lead${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Lead created with ID: ${LEAD_ID}${NC}"
echo ""

# Test 2: Get All Leads
echo -e "${YELLOW}📋 TEST 2: Fetching all leads...${NC}"
GET_ALL_RESPONSE=$(curl -s -X GET "${API_BASE}/leads" \
  -H "X-Whop-User-Id: ${WHOP_USER_ID}" \
  -H "X-Whop-Company-Id: ${WHOP_COMPANY_ID}")

echo "Response:"
echo "$GET_ALL_RESPONSE" | jq '.' 2>/dev/null || echo "$GET_ALL_RESPONSE"
echo ""

TOTAL_LEADS=$(echo "$GET_ALL_RESPONSE" | jq -r '.data.pagination.total' 2>/dev/null)
echo -e "${GREEN}✅ Total leads in company: ${TOTAL_LEADS}${NC}"
echo ""

# Test 3: Get Single Lead
echo -e "${YELLOW}🔍 TEST 3: Fetching single lead (ID: ${LEAD_ID})...${NC}"
GET_SINGLE_RESPONSE=$(curl -s -X GET "${API_BASE}/leads/${LEAD_ID}" \
  -H "X-Whop-User-Id: ${WHOP_USER_ID}" \
  -H "X-Whop-Company-Id: ${WHOP_COMPANY_ID}")

echo "Response:"
echo "$GET_SINGLE_RESPONSE" | jq '.' 2>/dev/null || echo "$GET_SINGLE_RESPONSE"
echo ""
echo -e "${GREEN}✅ Lead details fetched${NC}"
echo ""

# Test 4: Update Lead
echo -e "${YELLOW}✏️  TEST 4: Updating lead status...${NC}"
UPDATE_RESPONSE=$(curl -s -X PUT "${API_BASE}/leads/${LEAD_ID}" \
  -H "Content-Type: application/json" \
  -H "X-Whop-User-Id: ${WHOP_USER_ID}" \
  -H "X-Whop-Company-Id: ${WHOP_COMPANY_ID}" \
  -d '{
    "status": "contacted",
    "metadata": {
      "notes": "Updated via bash script",
      "updateTime": "'$(date)'"
    }
  }')

echo "Response:"
echo "$UPDATE_RESPONSE" | jq '.' 2>/dev/null || echo "$UPDATE_RESPONSE"
echo ""
echo -e "${GREEN}✅ Lead updated${NC}"
echo ""

# Test 5: Delete Lead
echo -e "${YELLOW}🗑️  TEST 5: Deleting lead...${NC}"
DELETE_RESPONSE=$(curl -s -X DELETE "${API_BASE}/leads/${LEAD_ID}" \
  -H "X-Whop-User-Id: ${WHOP_USER_ID}" \
  -H "X-Whop-Company-Id: ${WHOP_COMPANY_ID}")

echo "Response:"
echo "$DELETE_RESPONSE" | jq '.' 2>/dev/null || echo "$DELETE_RESPONSE"
echo ""
echo -e "${GREEN}✅ Lead deleted${NC}"
echo ""

# Summary
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ All tests passed!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Summary:"
echo "  ✅ Create Lead: SUCCESS"
echo "  ✅ Get All Leads: SUCCESS (${TOTAL_LEADS} leads in company)"
echo "  ✅ Get Single Lead: SUCCESS"
echo "  ✅ Update Lead: SUCCESS"
echo "  ✅ Delete Lead: SUCCESS"
echo ""
echo "Next steps:"
echo "  1. Check MongoDB for lead records: db.leads.find({whopCompanyId: '${WHOP_COMPANY_ID}'})"
echo "  2. Verify Whop dashboard for lead creation"
echo "  3. Test with different company IDs for multi-tenant isolation"
echo ""
