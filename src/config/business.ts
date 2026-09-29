// Everything the receptionist knows about the clinic lives in this file.
// To personalize the demo for a prospect, edit this file only.

export type Weekday = "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat";

export type Service = {
  id: string;
  name: string;
  durationMin: number;
  price: string;
  description: string;
};

export type OpeningHours = { open: string; close: string } | null;

export const business = {
  name: "Harbor Point Dental",
  tagline: "Family and cosmetic dentistry",
  notice: "Fictional clinic for demonstration only.",
  timeZone: "America/New_York",
  phone: "(555) 010-2040",
  emergencyPhone: "(555) 010-2099",
  email: "hello@harborpoint.example",
  address: "120 Harbor Point Ave, Suite 4, Portland, ME",
  accent: "#0f766e",

  slotMinutes: 30,
  bookingWindowDays: 45,
  minNoticeMinutes: 120,
  // Share of 30-minute blocks already taken by other (imaginary) patients,
  // so the calendar looks like a real, busy clinic.
  seedBusyPercent: 40,

  hours: {
    mon: { open: "09:00", close: "17:00" },
    tue: { open: "09:00", close: "17:00" },
    wed: { open: "09:00", close: "17:00" },
    thu: { open: "10:00", close: "19:00" },
    fri: { open: "09:00", close: "15:00" },
    sat: { open: "09:00", close: "13:00" },
    sun: null,
  } satisfies Record<Weekday, OpeningHours>,

  services: [
    {
      id: "checkup",
      name: "Check-up and cleaning",
      durationMin: 60,
      price: "$145",
      description: "Exam, professional cleaning and polish. X-rays included when due.",
    },
    {
      id: "new-patient",
      name: "New patient exam",
      durationMin: 90,
      price: "$195",
      description: "Full exam, X-rays, cleaning and a treatment plan for first-time patients.",
    },
    {
      id: "kids-checkup",
      name: "Children's check-up (under 12)",
      durationMin: 30,
      price: "$85",
      description: "Gentle exam and cleaning for children under 12.",
    },
    {
      id: "filling",
      name: "Filling",
      durationMin: 60,
      price: "from $180",
      description: "Tooth-colored filling. Final price depends on size and tooth.",
    },
    {
      id: "whitening-consult",
      name: "Whitening consultation",
      durationMin: 30,
      price: "Free",
      description: "Shade check and whitening options. In-office whitening is $450.",
    },
    {
      id: "emergency",
      name: "Emergency visit",
      durationMin: 30,
      price: "$120",
      description: "Toothache, broken or knocked-out tooth, lost filling or crown.",
    },
  ] satisfies Service[],

  policies: [
    "Insurance: we accept most PPO dental plans and bill them directly. We check coverage before the visit. We are not in-network with HMO plans.",
    "Payment: all major cards, HSA and FSA cards. 0% payment plans are available for treatment over $500.",
    "Cancellations: please give 24 hours' notice. Late cancellations and missed appointments have a $50 fee.",
    "New patients: arrive 15 minutes early and bring a photo ID and your insurance card.",
    "Children: a parent or guardian must attend with patients under 18.",
    "Comfort: nitrous oxide (laughing gas) is available for anxious patients at $60 per visit.",
    "Emergencies: same-day emergency slots are held every weekday. After hours, call the emergency line.",
    "Parking: free parking in the lot behind the building. Step-free access through the rear entrance.",
    "Languages: the team speaks English and Spanish.",
  ],

  suggestions: [
    "How much is a check-up?",
    "Book a cleaning next Tuesday morning",
    "Do you take my insurance?",
    "I have a really bad toothache",
  ],
};

export const serviceIds = business.services.map((s) => s.id) as [string, ...string[]];

export function getService(id: string): Service | undefined {
  return business.services.find((s) => s.id === id);
}
