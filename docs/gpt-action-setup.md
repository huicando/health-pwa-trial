# Health GPT Action setup

This Action lets a custom GPT save confirmed health records from the ChatGPT mobile app.

## 1. Deploy the Edge Function

In Supabase Dashboard, open **Edge Functions** and choose **Deploy a new function** -> **Via Editor**.

- Function name: `health-agent`
- Paste `supabase/functions/health-agent/index.ts` from this repository.
- Disable JWT verification for this function.
- Deploy it.

## 2. Add function secrets

In **Edge Functions** -> **Secrets**, add these values. Do not put any of them in GitHub or in the GPT instructions.

- `HEALTH_AGENT_TOKEN`: a new random secret used only by the GPT Action.
- `HEALTH_ACCESS_CODE`: the existing code attached to the health rows.
- `SUPABASE_SERVICE_ROLE_KEY`: the Supabase legacy `service_role` key or current secret key.

## 3. Configure the custom GPT

On ChatGPT web, create a custom GPT. In **Configure** -> **Actions**, create an action and import `public/health-agent-openapi.yaml`.

Set authentication to **API key** -> **Bearer**. Paste the exact value of `HEALTH_AGENT_TOKEN` as the secret.

Use this instruction in the GPT:

```text
You are a health record coach. Before giving advice, call getHealthContext for today and the recent 7 days. Before calling createHealthRecord, summarize the proposed date, record type, foods or health metrics, and key estimates. Only write after the user explicitly confirms. Never reveal Action credentials or infer a medical diagnosis.
```

Save the GPT. In the ChatGPT mobile app, open this custom GPT instead of a normal chat. Test it with a read request first, then confirm one small record write.
