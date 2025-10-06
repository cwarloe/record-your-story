# Supabase Edge Functions

This directory contains Supabase Edge Functions for server-side operations.

## Functions

### send-invitation

Sends email invitations to non-users using SendGrid.

**Environment Variables Required:**
- `SENDGRID_API_KEY` - Your SendGrid API key

## Setup

### 1. Install Supabase CLI

```bash
npm install -g supabase
```

### 2. Login to Supabase

```bash
supabase login
```

### 3. Link to Your Project

```bash
supabase link --project-ref jzrljyzosqrjkaupufsb
```

### 4. Set Environment Variables

In Supabase Dashboard → Edge Functions → Settings:

```bash
SENDGRID_API_KEY=your_sendgrid_api_key_here
```

Or via CLI:

```bash
supabase secrets set SENDGRID_API_KEY=your_sendgrid_api_key_here
```

### 5. Deploy Functions

Deploy all functions:

```bash
supabase functions deploy
```

Deploy specific function:

```bash
supabase functions deploy send-invitation
```

## Testing Locally

Start local development server:

```bash
supabase functions serve send-invitation --env-file .env.local
```

Test the function:

```bash
curl -i --location --request POST 'http://localhost:54321/functions/v1/send-invitation' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "test@example.com",
    "senderName": "John Doe",
    "eventTitle": "My Birthday Party",
    "timelineId": "uuid-here",
    "invitationType": "collaborate"
  }'
```

## SendGrid Setup

1. Create account at https://sendgrid.com
2. Create API key with "Mail Send" permissions
3. Verify sender email at `invitations@record-your-story.app` (or your domain)
4. Add API key to Supabase secrets

## Troubleshooting

**Function not found:**
- Ensure function is deployed: `supabase functions list`
- Check project is linked: `supabase projects list`

**SendGrid errors:**
- Verify API key is set correctly
- Check sender email is verified in SendGrid dashboard
- Review SendGrid activity feed for delivery issues

**Database errors:**
- Ensure migration `v2.3.0_email_invitations.sql` has been run
- Check RLS policies allow function to write to `timeline_invitations`
