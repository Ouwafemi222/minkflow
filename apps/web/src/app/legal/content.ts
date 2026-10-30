/**
 * DRAFT legal copy for the closed beta. Must be reviewed by a qualified lawyer before public launch
 * (docs/VERIFY.md). Bracketed placeholders are filled in by the founder; do not invent company details.
 */
export interface LegalDoc {
  title: string;
  summary: string;
  sections: { heading: string; body: string[] }[];
}

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  terms: {
    title: 'Terms of Service',
    summary: 'The rules for using Minkflow during the beta.',
    sections: [
      { heading: 'Who we are', body: ['Minkflow is operated by [Company legal name], [registered address] ("we", "us"). Contact: [support email].'] },
      { heading: 'The service', body: ['Minkflow helps you turn a topic into an animated explainer video using AI-generated scripts, storyboards and voiceover. The service is in beta: features may change, and output may contain mistakes.'] },
      {
        heading: 'Your content and responsibility',
        body: [
          'You own the topics, scripts and edits you provide, and, subject to these terms and payment of any credits due, the videos you export.',
          'AI output can be inaccurate. Minkflow flags factual claims for review, but you are responsible for checking the accuracy of everything you publish, and for having the rights to any logo or brand material you upload.',
        ],
      },
      { heading: 'Acceptable use', body: ['You must follow the Acceptable Use Policy. We may refuse, stop or remove generation that breaks it, and suspend accounts that repeatedly do.'] },
      { heading: 'Credits', body: ['Generation and rendering use credits. Credit prices, refunds and expiry are described in the Credits & Refunds policy.'] },
      { heading: 'Availability and liability', body: ['The beta is provided "as is". To the extent permitted by law, our total liability is limited to the amount you paid us in the 3 months before the claim. [Jurisdiction-specific wording to be confirmed by counsel.]'] },
      { heading: 'Changes and termination', body: ['We will notify you of material changes by email or in the app. You can delete your projects and close your account at any time.'] },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    summary: 'What we collect, why, and how long we keep it.',
    sections: [
      { heading: 'What we collect', body: ['Account data (email address), the topics, scripts, storyboards and uploads you create, billing records (handled by our payment processor; we do not store card numbers), and technical logs needed to run and secure the service.'] },
      {
        heading: 'Service providers',
        body: [
          'We use: Supabase (database and sign-in), OpenAI (script and storyboard generation, content moderation), ElevenLabs (voiceover), Cloudflare R2 (file storage), Vercel and Railway (hosting), Paystack (payments) and Sentry (error monitoring).',
          'Your topic and script text is sent to OpenAI and ElevenLabs to generate content. [Confirm each provider’s data-retention and training settings before launch.]',
        ],
      },
      {
        heading: 'Retention',
        body: [
          'Final MP4 exports are kept for 30 days after rendering. Draft previews and generated drafts are kept for 7 days. Voiceover audio is kept while it is used by a project and for up to 30 days after its last use. Projects are kept until you delete them.',
          'Billing and credit records are kept as long as required for accounting and tax purposes.',
        ],
      },
      { heading: 'Your rights', body: ['You can access, export or delete your data by contacting [support email]. Deleting a project removes its files on the next cleanup run.'] },
    ],
  },
  'acceptable-use': {
    title: 'Acceptable Use Policy',
    summary: 'What you may not use Minkflow to create.',
    sections: [
      {
        heading: 'Not allowed',
        body: [
          'Content that is illegal, sexual content involving minors, harassment or hate, incitement to violence, or instructions for weapons or serious harm.',
          'Deliberate misinformation presented as fact, impersonation of real people, or voice content intended to deceive.',
          'Content that infringes someone else’s copyright or trademark, including logos you do not have rights to.',
          'Attempts to abuse, overload, reverse-engineer or bypass the limits and safety checks of the service.',
        ],
      },
      { heading: 'Enforcement', body: ['Topics and scripts are automatically checked. Blocked requests are not charged. Repeated violations may lead to suspension.'] },
    ],
  },
  refunds: {
    title: 'Credits & Refunds',
    summary: 'How credits are charged and returned.',
    sections: [
      {
        heading: 'How credits work',
        body: [
          'Each step shows its credit cost before you start. Credits are reserved when a step starts and only the actual usage is charged when it finishes, never more than the quote.',
          'If a step fails or you cancel it, reserved credits are returned automatically. Reusing voiceover that was already generated is free.',
        ],
      },
      { heading: 'Purchases', body: ['Credit packs are priced in USD and processed by Paystack. During the beta, credits do not expire. Unused purchased credits can be refunded within 14 days of purchase on request to [support email]. [Confirm local consumer-law requirements.]'] },
      { heading: 'Beta credits', body: ['Free credits granted during the beta have no cash value and cannot be refunded.'] },
    ],
  },
};
