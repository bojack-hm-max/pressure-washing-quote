# Clearline Pressure Washing — Instant Quote

A responsive quote calculator with a Netlify serverless email function.

## Pricing rules
- House: $0.15 per square foot
- Driveway: $0.12 per square foot
- Deck: $0.30 per square foot
- Fence: $1.00 per linear foot
- Minimum total: $150

## Deploy publicly (Netlify)
1. Create a GitHub repository and upload these files, or drag this project folder into a new repository.
2. Sign in to Netlify and choose **Add new site → Import an existing project**. Connect the repository.
3. In the site's **Environment variables** settings, add `RESEND_API_KEY` with an API key from https://resend.com.
4. Optional: set `EMAIL_FROM` to a sender address verified in your Resend account. The default Resend onboarding sender is suitable only for limited testing and may not deliver to arbitrary recipients.
5. Deploy. Netlify will provide a public HTTPS URL.

## Email setup notes
The function emails quote details to `careers@finchharbor.com` through Resend. For production, verify a sending domain in Resend and set `EMAIL_FROM` to an address on that domain. Keep `RESEND_API_KEY` only in Netlify environment variables; never put it in frontend code.

## Local preview
Open `index.html` to preview the quote calculator UI. Sending email requires deployment or a local Netlify Functions environment with the environment variable configured.

## Calculation
Each selected service is measured in its relevant unit and priced at the rate above. The quote total is `max($150, sum of selected service subtotals)`. This is an estimate, not a binding final invoice.
