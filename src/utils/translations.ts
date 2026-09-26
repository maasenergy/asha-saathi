/**
 * Bilingual Translations & Medical Terminologies (Hindi / English)
 */
import { AppLanguage } from '../types';

export const t = {
  // App branding & disclaimers
  appName: {
    hi: 'आशा साथी',
    en: 'ASHA Saathi',
  },
  byLine: {
    hi: 'माँस डॉक्टर द्वारा',
    en: 'by Maas Doc',
  },
  prototypeBanner: {
    hi: 'डेमो केवल • काल्पनिक डेटा • निर्णय सहायता प्रणाली • वास्तविक नैदानिक निर्णय केवल डॉक्टर लेते हैं',
    en: 'Simulation with synthetic data • Decision support only • Doctor makes clinical decisions',
  },
  demoPill: {
    hi: 'डेमो मोड (काल्पनिक डेटा)',
    en: 'Demo Mode (Synthetic Data)',
  },
  resetDemo: {
    hi: 'डेमो रीसेट करें',
    en: 'Reset Demo',
  },
  
  // Roles
  roleAsha: {
    hi: 'आशा कार्यकर्ता (ASHA)',
    en: 'ASHA Worker',
  },
  roleDoctor: {
    hi: 'डॉक्टर / मेडिकल ऑफिसर',
    en: 'Doctor / Medical Officer',
  },
  roleMother: {
    hi: 'गर्भवती माता',
    en: 'Expectant Mother',
  },

  // ASHA tabs
  tabTodayVisits: {
    hi: 'आज किससे मिलना है',
    en: 'Today’s Visits',
  },
  tabNewVisit: {
    hi: 'नई विज़िट',
    en: 'New Visit',
  },
  tabMyMothers: {
    hi: 'मेरी माताएँ',
    en: 'My Mothers',
  },
  tabAlerts: {
    hi: 'अलर्ट एवं संदेश',
    en: 'Alerts & Advice',
  },

  // Common clinical terms
  bloodPressure: {
    hi: 'रक्तचाप (BP)',
    en: 'Blood Pressure (BP)',
  },
  systolic: {
    hi: 'सिस्टोलिक (Systolic)',
    en: 'Systolic',
  },
  diastolic: {
    hi: 'डायस्टोलिक (Diastolic)',
    en: 'Diastolic',
  },
  gestationalWeeks: {
    hi: 'गर्भ के सप्ताह',
    en: 'Gestational Weeks',
  },
  symptoms: {
    hi: 'लक्षण व तकलीफें',
    en: 'Reported Symptoms',
  },
  otherObservations: {
    hi: 'अन्य अवलोकन / पोषण',
    en: 'Other Observations',
  },
  notProvided: {
    hi: 'उपलब्ध नहीं',
    en: 'Not provided',
  },
  unknown: {
    hi: 'अज्ञात',
    en: 'Unknown',
  },

  // Input modes
  modeVoice: {
    hi: 'आवाज़ (वॉयस)',
    en: 'Voice Input',
  },
  modeTyping: {
    hi: 'टाइपिंग (लिखें)',
    en: 'Typed Text',
  },
  modeForm: {
    hi: 'सीधा फॉर्म',
    en: 'Direct Form',
  },

  // Tests tracker
  testsTrackerTitle: {
    hi: 'प्रसव पूर्व आवश्यक जाँचें (ANC Tests)',
    en: 'Antenatal Clinical Tests',
  },
  testsDone: {
    hi: 'कराई गई जाँचें',
    en: 'Tests Completed',
  },
  testsPending: {
    hi: 'बाकी जाँचें',
    en: 'Tests Pending / Due',
  },
  markAsDone: {
    hi: 'जाँच पूरी हुई दर्ज करें',
    en: 'Mark as Completed',
  },

  // Severities
  severityRed: {
    hi: 'तुरंत आवश्यक (Urgent): तत्काल डॉक्टर समीक्षा आवश्यक',
    en: 'URGENT: Immediate Doctor Review Required',
  },
  severityAmber: {
    hi: 'ध्यान दें (Attention): डॉक्टर से जांच आवश्यक',
    en: 'ATTENTION: Medical Review Needed',
  },
  severityGreen: {
    hi: 'सामान्य (Normal): नियमित देखभाल जारी रखें',
    en: 'NORMAL: Routine Antenatal Care',
  },

  // Alert Lifecycle statuses
  statusCreated: {
    hi: 'दर्ज किया गया',
    en: 'Created',
  },
  statusVisible: {
    hi: 'डेमो में दृश्यमान (अलर्ट भेजा गया)',
    en: 'Visible in demo',
  },
  statusAcknowledged: {
    hi: 'डॉक्टर द्वारा देखा गया (स्वीकृत)',
    en: 'Acknowledged by doctor',
  },
  statusResponded: {
    hi: 'डॉक्टर की सलाह प्राप्त हुई',
    en: 'Doctor responded',
  },

  // Call actions
  call108: {
    hi: '108 आपातकालीन एम्बुलेंस',
    en: 'Call 108 Emergency',
  },
  call102: {
    hi: '102 जननी शिशु वाहन',
    en: 'Call 102 Matritva Vahan',
  },
  seekInPersonCare: {
    hi: 'चेतावनी: यह डेमो वास्तविक एम्बुलेंस नहीं भेजता। आपात स्थिति में तुरंत 108 पर कॉल करें या नजदीकी अस्पताल जाएं।',
    en: 'Emergency Notice: This prototype does not dispatch real ambulances. Please dial 108 or proceed to the nearest hospital immediately.',
  },
};

export function getTranslation(key: keyof typeof t, lang: AppLanguage): string {
  const item = t[key];
  if (!item) return String(key);
  return item[lang] || item['en'];
}
