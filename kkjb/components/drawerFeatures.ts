/*
 * SIDE-MENU FEATURES - things you can ONLY find in the side menu.
 *
 * The bottom tabs already cover Drive, Activity and Account (wallet, PIN,
 * appearance, log out), so the side menu is for the extras around them.
 *
 * Each object below does two jobs:
 *   1. it becomes a row in the side menu, and
 *   2. it feeds the preview screen at app/feature/[slug].tsx.
 * To add a new side-menu feature, add one object to this list - nothing else.
 */

export interface FeatureRow {
    title: string;
    subtitle: string;
    tag?: string;
}

export interface DrawerFeature {
    slug: string;      // used in the URL: /feature/my-routes
    icon: string;
    title: string;
    note: string;      // small grey line under the title in the side menu
    intro: string;     // explanation at the top of the feature screen
    rows: FeatureRow[]; // sample content (mock data for now)
    cta?: string;      // label of the main button
}

export const DRAWER_FEATURES: DrawerFeature[] = [
    {
        slug: 'my-routes',
        icon: '🔁',
        title: 'My regular routes',
        note: 'Daily trips we match for you',
        intro:
            'Save the trips you do every week. We match you with drivers and riders on the same route automatically, so you never have to search twice.',
        rows: [
            { title: 'Block 8 → UB Main Campus', subtitle: 'Mon – Fri · 07:15', tag: 'Auto-match on' },
            { title: 'UB Main Campus → Block 8', subtitle: 'Mon – Fri · 16:30', tag: 'Auto-match on' },
            { title: 'Game City → Tlokweng', subtitle: 'Sat · 10:00', tag: 'Paused' },
        ],
        cta: 'Add a route',
    },
    {
        slug: 'intercity',
        icon: '🛣️',
        title: 'Intercity carpooling',
        note: 'Gaborone – Lobatse / Francistown',
        intro:
            'Share longer trips between towns and split the fuel. Drivers heading your way show up here.',
        rows: [
            { title: 'Gaborone → Lobatse', subtitle: 'Fri · 17:00 · 2 seats left', tag: 'Driver offer' },
            { title: 'Gaborone → Francistown', subtitle: 'Sun · 08:00 · 3 seats left', tag: 'Driver offer' },
            { title: 'Francistown → Gaborone', subtitle: 'Mon · 06:00 · 1 seat left', tag: 'Driver offer' },
        ],
        cta: 'Find an intercity ride',
    },
    {
        slug: 'trusted-contacts',
        icon: '🛡️',
        title: 'Trusted contacts',
        note: 'Let someone follow your trip',
        intro:
            'Choose people who can follow your live trip and get an alert if you press SOS. They don’t need the app.',
        rows: [
            { title: 'Kabelo T.', subtitle: '+267 74 ••• 118', tag: 'Gets live trip link' },
            { title: 'Lorato K.', subtitle: '+267 71 ••• 305', tag: 'Gets live trip link' },
        ],
        cta: 'Add a trusted contact',
    },
    {
        slug: 'invite',
        icon: '🎟️',
        title: 'Invite classmates',
        note: 'More riders = faster matches',
        intro:
            'Every new rider on your route makes matching faster for everyone. Share your invite link with classmates and neighbours.',
        rows: [
            { title: 'Your invite code', subtitle: 'NEO-4821', tag: 'Tap to copy' },
            { title: 'Friends joined', subtitle: '3 so far' },
        ],
        cta: 'Share invite link',
    },
    {
        slug: 'help',
        icon: '💬',
        title: 'Help & feedback',
        note: 'FAQs, report a problem',
        intro: 'Something not working, or a ride that didn’t feel safe? Tell us and we’ll look into it.',
        rows: [
            { title: 'How matching works', subtitle: 'Why you see the drivers you see' },
            { title: 'Safety tips', subtitle: 'Before, during and after a ride' },
            { title: 'Report a problem', subtitle: 'About a ride or a driver' },
        ],
        cta: 'Contact support',
    },
];

export const getFeature = (slug?: string) => DRAWER_FEATURES.find((f) => f.slug === slug);
