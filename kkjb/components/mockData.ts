/*
 * MOCK DATA - stand-in values until the real back-end is connected.
 *
 * Every screen reads these from here (instead of typing "Neo Molefe" in five
 * different files). When Kaene's database is ready, this is the one file
 * whose values get replaced with real data from the server.
 */

export const MOCK_USER = {
    name: 'Neo Molefe',
    initials: 'NM',
    email: 'neo.molefe@ub.ac.bw',
    rating: 4.95,
    walletBalance: 120, // Pula
    isVerifiedStudent: true,
};
