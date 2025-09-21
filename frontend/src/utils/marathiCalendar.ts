// Marathi Calendar and Season Mapping for Indian Classical Music
// Based on traditional Marathi calendar and raga seasons

export interface MarathiMonth {
  marathi: string;
  english: string;
  season: string;
  seasonMarathi: string;
  gregorianMonths: string;
  description: string;
}

export interface SeasonInfo {
  english: string;
  marathi: string;
  months: string[];
  description: string;
  ragaCharacteristics: string;
}

// Marathi months with their corresponding seasons
export const MARATHI_MONTHS: MarathiMonth[] = [
  {
    marathi: 'चैत्र',
    english: 'Chaitra',
    season: 'Vasant',
    seasonMarathi: 'वसंत',
    gregorianMonths: 'March-April',
    description: 'Spring begins, new year starts'
  },
  {
    marathi: 'वैशाख',
    english: 'Vaishakh',
    season: 'Vasant',
    seasonMarathi: 'वसंत',
    gregorianMonths: 'April-May',
    description: 'Peak spring, harvest time'
  },
  {
    marathi: 'ज्येष्ठ',
    english: 'Jyeshtha',
    season: 'Grishma',
    seasonMarathi: 'ग्रीष्म',
    gregorianMonths: 'May-June',
    description: 'Summer begins, hot weather'
  },
  {
    marathi: 'आषाढ',
    english: 'Ashadha',
    season: 'Grishma',
    seasonMarathi: 'ग्रीष्म',
    gregorianMonths: 'June-July',
    description: 'Peak summer, monsoon preparation'
  },
  {
    marathi: 'श्रावण',
    english: 'Shravan',
    season: 'Varsha',
    seasonMarathi: 'वर्षा',
    gregorianMonths: 'July-August',
    description: 'Monsoon begins, rainy season'
  },
  {
    marathi: 'भाद्रपद',
    english: 'Bhadrapada',
    season: 'Varsha',
    seasonMarathi: 'वर्षा',
    gregorianMonths: 'August-September',
    description: 'Peak monsoon, heavy rains'
  },
  {
    marathi: 'आश्विन',
    english: 'Ashwin',
    season: 'Sharad',
    seasonMarathi: 'शरद',
    gregorianMonths: 'September-October',
    description: 'Autumn begins, clear skies'
  },
  {
    marathi: 'कार्तिक',
    english: 'Kartik',
    season: 'Sharad',
    seasonMarathi: 'शरद',
    gregorianMonths: 'October-November',
    description: 'Peak autumn, festival season'
  },
  {
    marathi: 'मार्गशीर्ष',
    english: 'Margashirsha',
    season: 'Hemant',
    seasonMarathi: 'हेमंत',
    gregorianMonths: 'November-December',
    description: 'Pre-winter begins, cool weather'
  },
  {
    marathi: 'पौष',
    english: 'Pausha',
    season: 'Hemant',
    seasonMarathi: 'हेमंत',
    gregorianMonths: 'December-January',
    description: 'Peak pre-winter, cold mornings'
  },
  {
    marathi: 'माघ',
    english: 'Magha',
    season: 'Shishir',
    seasonMarathi: 'शिशिर',
    gregorianMonths: 'January-February',
    description: 'Winter begins, coldest period'
  },
  {
    marathi: 'फाल्गुन',
    english: 'Phalguna',
    season: 'Shishir',
    seasonMarathi: 'शिशिर',
    gregorianMonths: 'February-March',
    description: 'Late winter, spring preparation'
  }
];

// Season information with raga characteristics
export const SEASONS: SeasonInfo[] = [
  {
    english: 'Vasant',
    marathi: 'वसंत',
    months: ['Chaitra', 'Vaishakh'],
    description: 'Spring - Season of renewal and joy',
    ragaCharacteristics: 'Fresh, lively, and uplifting ragas. Associated with morning and early evening.'
  },
  {
    english: 'Grishma',
    marathi: 'ग्रीष्म',
    months: ['Jyeshtha', 'Ashadha'],
    description: 'Summer - Hot and intense season',
    ragaCharacteristics: 'Deep, intense, and powerful ragas. Often associated with late evening and night.'
  },
  {
    english: 'Varsha',
    marathi: 'वर्षा',
    months: ['Shravan', 'Bhadrapada'],
    description: 'Monsoon - Rainy season',
    ragaCharacteristics: 'Melancholic, romantic, and contemplative ragas. Perfect for rainy evenings.'
  },
  {
    english: 'Sharad',
    marathi: 'शरद',
    months: ['Ashwin', 'Kartik'],
    description: 'Autumn - Clear and pleasant season',
    ragaCharacteristics: 'Clear, bright, and melodious ragas. Associated with evening and night.'
  },
  {
    english: 'Hemant',
    marathi: 'हेमंत',
    months: ['Margashirsha', 'Pausha'],
    description: 'Pre-winter - Cool and comfortable season',
    ragaCharacteristics: 'Warm, comforting, and devotional ragas. Perfect for late evening.'
  },
  {
    english: 'Shishir',
    marathi: 'शिशिर',
    months: ['Magha', 'Phalguna'],
    description: 'Winter - Cold and serene season',
    ragaCharacteristics: 'Serene, meditative, and deep ragas. Associated with early morning and late night.'
  }
];

// Get current season based on Marathi calendar
export const getCurrentSeason = (date: Date = new Date()): SeasonInfo => {
  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();
  
  // Approximate mapping based on Marathi calendar
  if ((month === 3 && day >= 15) || month === 4) {
    return SEASONS[0]; // Vasant
  } else if ((month === 4 && day >= 15) || month === 5 || (month === 6 && day <= 14)) {
    return SEASONS[1]; // Grishma
  } else if ((month === 6 && day >= 15) || month === 7 || (month === 8 && day <= 14)) {
    return SEASONS[2]; // Varsha
  } else if ((month === 8 && day >= 15) || month === 9 || (month === 10 && day <= 14)) {
    return SEASONS[3]; // Sharad
  } else if ((month === 10 && day >= 15) || month === 11 || (month === 12 && day <= 14)) {
    return SEASONS[4]; // Hemant
  } else {
    return SEASONS[5]; // Shishir
  }
};

// Get current Marathi month
export const getCurrentMarathiMonth = (date: Date = new Date()): MarathiMonth => {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  // Approximate mapping
  if ((month === 3 && day >= 15) || (month === 4 && day <= 14)) {
    return MARATHI_MONTHS[0]; // Chaitra
  } else if ((month === 4 && day >= 15) || (month === 5 && day <= 14)) {
    return MARATHI_MONTHS[1]; // Vaishakh
  } else if ((month === 5 && day >= 15) || (month === 6 && day <= 14)) {
    return MARATHI_MONTHS[2]; // Jyeshtha
  } else if ((month === 6 && day >= 15) || (month === 7 && day <= 14)) {
    return MARATHI_MONTHS[3]; // Ashadha
  } else if ((month === 7 && day >= 15) || (month === 8 && day <= 14)) {
    return MARATHI_MONTHS[4]; // Shravan
  } else if ((month === 8 && day >= 15) || (month === 9 && day <= 14)) {
    return MARATHI_MONTHS[5]; // Bhadrapada
  } else if ((month === 9 && day >= 15) || (month === 10 && day <= 14)) {
    return MARATHI_MONTHS[6]; // Ashwin
  } else if ((month === 10 && day >= 15) || (month === 11 && day <= 14)) {
    return MARATHI_MONTHS[7]; // Kartik
  } else if ((month === 11 && day >= 15) || (month === 12 && day <= 14)) {
    return MARATHI_MONTHS[8]; // Margashirsha
  } else if ((month === 12 && day >= 15) || (month === 1 && day <= 14)) {
    return MARATHI_MONTHS[9]; // Pausha
  } else if ((month === 1 && day >= 15) || (month === 2 && day <= 14)) {
    return MARATHI_MONTHS[10]; // Magha
  } else {
    return MARATHI_MONTHS[11]; // Phalguna
  }
};

// Get all seasons for dropdown/selection
export const getAllSeasons = (): SeasonInfo[] => SEASONS;

// Get all Marathi months for dropdown/selection
export const getAllMarathiMonths = (): MarathiMonth[] => MARATHI_MONTHS;

// Format season display with Marathi text
export const formatSeasonDisplay = (season: string): string => {
  const seasonInfo = SEASONS.find(s => s.english === season);
  if (seasonInfo) {
    return `${seasonInfo.english} (${seasonInfo.marathi})`;
  }
  return season;
};

// Format month display with Marathi text
export const formatMonthDisplay = (month: string): string => {
  const monthInfo = MARATHI_MONTHS.find(m => m.english === month);
  if (monthInfo) {
    return `${monthInfo.english} (${monthInfo.marathi})`;
  }
  return month;
};
