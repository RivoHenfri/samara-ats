export function getWhatsAppMessage(candidate, role, stage, lang) {
    const name = candidate?.full_name?.split(' ')[0] || 'there'
    const roleTitle = role?.title || 'the position'

    const templates = {
        New: {
            en: `Hi ${name}, this is Satya from Samara Lombok. We received your application for ${roleTitle} and would love to learn more about you. Are you available for a quick chat?`,
            id: `Halo ${name}, perkenalkan saya Satya dari Samara Lombok. Kami menerima lamaran Anda untuk posisi ${roleTitle} dan ingin mengenal Anda lebih lanjut. Apakah Anda ada waktu untuk ngobrol sebentar?`,
        },
        Screening: {
            en: `Hi ${name}, this is Satya from Samara Lombok. We'd like to schedule a screening call for the ${roleTitle} role. When are you available this week?`,
            id: `Halo ${name}, ini Satya dari Samara Lombok. Kami ingin menjadwalkan sesi screening untuk posisi ${roleTitle}. Kapan Anda tersedia minggu ini?`,
        },
        Interview: {
            en: `Hi ${name}, this is Satya from Samara Lombok. Great news — we'd like to invite you for an interview for the ${roleTitle} position. Please let us know your availability.`,
            id: `Halo ${name}, ini Satya dari Samara Lombok. Kabar baik — kami ingin mengundang Anda untuk interview posisi ${roleTitle}. Mohon informasikan ketersediaan waktu Anda.`,
        },
        Offer: {
            en: `Hi ${name}, this is Satya from Samara Lombok. We're excited to move forward with you for the ${roleTitle} role. Can we schedule a call to discuss the offer details?`,
            id: `Halo ${name}, ini Satya dari Samara Lombok. Kami senang ingin melanjutkan proses dengan Anda untuk posisi ${roleTitle}. Bisakah kita jadwalkan panggilan untuk membahas detail penawaran?`,
        },
        Hired: {
            en: `Hi ${name}, congratulations and welcome to Samara Lombok! We're thrilled to have you joining us as ${roleTitle}. We'll be in touch soon with your onboarding details.`,
            id: `Halo ${name}, selamat dan selamat datang di Samara Lombok! Kami sangat senang Anda bergabung sebagai ${roleTitle}. Kami akan segera menghubungi Anda dengan detail onboarding.`,
        },
        Rejected: {
            en: `Hi ${name}, this is Satya from Samara Lombok. Thank you for your interest in the ${roleTitle} role. After careful consideration, we'll be moving forward with other candidates. We wish you all the best!`,
            id: `Halo ${name}, ini Satya dari Samara Lombok. Terima kasih atas minat Anda pada posisi ${roleTitle}. Setelah pertimbangan matang, kami akan melanjutkan dengan kandidat lain. Semoga sukses selalu!`,
        },
    }

    const template = templates[stage] || templates.New
    return lang === 'id' ? template.id : template.en
}
