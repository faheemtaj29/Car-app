/**
 * Built-in catalogue of brands, models and cities sold in Pakistan. Every
 * dropdown on the site starts from this list (so buyers see all brands even
 * before anything is listed), and anything sellers add that is not here is
 * merged in from the database.
 */

export type Kind = "car" | "bike";

export const CAR_MODELS: Record<string, string[]> = {
  Toyota: ["Corolla", "Corolla Cross", "Yaris", "Vitz", "Aqua", "Prius", "Passo", "Belta", "Premio", "Allion", "Axio", "Fielder", "Camry", "Crown", "Mark X", "Fortuner", "Hilux", "Hilux Revo", "Land Cruiser", "Land Cruiser Prado", "Rush", "Raize", "C-HR", "Hiace", "Probox", "Pixis", "Roomy", "Rav4"],
  Suzuki: ["Alto", "Cultus", "Wagon R", "Swift", "Mehran", "Bolan", "Every", "Ravi", "Jimny", "Ciaz", "Vitara", "Hustler", "Spacia", "Kizashi", "Liana", "Baleno", "APV", "Khyber", "Margalla", "Mega Carry"],
  Honda: ["Civic", "City", "BR-V", "HR-V", "Accord", "Vezel", "Fit", "Grace", "N-Wgn", "N-Box", "N-One", "Insight", "CR-V", "Freed", "Life", "Zest"],
  KIA: ["Sportage", "Picanto", "Sorento", "Stonic", "Carnival", "Sonet", "Rio", "Spectra", "Sephia", "Frontier"],
  Hyundai: ["Tucson", "Elantra", "Sonata", "Santa Fe", "Staria", "Ioniq", "Porter", "Santro", "Shehzore", "Excel"],
  Changan: ["Alsvin", "Oshan X7", "Karvaan", "M9", "Uni-T", "CS35"],
  MG: ["HS", "ZS", "ZS EV", "5", "GT", "4 EV"],
  Haval: ["H6", "Jolion", "H6 HEV"],
  Proton: ["Saga", "X70", "X50"],
  "DFSK": ["Glory 580", "Glory 500", "Seres 3"],
  Nissan: ["Dayz", "Sunny", "Note", "Juke", "Moco", "Clipper", "Roox", "Kicks", "Patrol", "Navara", "X-Trail", "AD Van", "Bluebird"],
  Daihatsu: ["Mira", "Move", "Cuore", "Hijet", "Tanto", "Boon", "Cast", "Coure", "Terios", "Charade", "Rocky"],
  Mitsubishi: ["Lancer", "Pajero", "Pajero Mini", "eK Wagon", "Mirage", "Outlander", "L200", "Minica"],
  Mazda: ["Carol", "Flair", "Scrum", "Axela", "Demio", "CX-5", "RX-8"],
  Subaru: ["Impreza", "Forester", "Legacy", "Stella", "Pleo"],
  Isuzu: ["D-Max", "MU-X"],
  "Mercedes Benz": ["A Class", "C Class", "E Class", "S Class", "GLA", "GLC", "GLE", "G Class", "EQS"],
  BMW: ["1 Series", "3 Series", "5 Series", "7 Series", "X1", "X3", "X5", "X7", "i4", "iX"],
  Audi: ["A3", "A4", "A5", "A6", "A8", "Q2", "Q3", "Q5", "Q7", "Q8", "e-tron"],
  Lexus: ["LX", "RX", "NX", "ES", "LS", "UX"],
  "Range Rover": ["Evoque", "Sport", "Velar", "Vogue"],
  Porsche: ["Cayenne", "Macan", "Panamera", "911", "Taycan"],
  Volkswagen: ["Golf", "Passat", "Tiguan", "Touareg", "Beetle"],
  Chevrolet: ["Joy", "Optra", "Cruze", "Exclusive"],
  FAW: ["V2", "X-PV", "Carrier", "Sirius S80"],
  Prince: ["Pearl", "K01"],
  "United": ["Bravo", "Alpha"],
  BYD: ["Atto 3", "Seal", "Shark 6", "Dolphin"],
  Chery: ["Tiggo 4 Pro", "Tiggo 8 Pro", "QQ"],
  GWM: ["Tank 500", "Ora 03"],
  JAC: ["T9", "X200"],
  "Tesla": ["Model 3", "Model Y", "Model S", "Model X"],
};

export const BIKE_MODELS: Record<string, string[]> = {
  Honda: ["CD 70", "CD 70 Dream", "CG 125", "CG 125 Self Start", "Pridor", "CB 125F", "CB 150F", "CB 250F", "Deluxe 125"],
  Yamaha: ["YBR 125", "YBR 125G", "YB 125Z", "YB 125Z-DX", "YZF-R15", "Dhoom"],
  Suzuki: ["GD 110S", "GS 150", "GS 150 SE", "GR 150", "GSX 125", "Raider 110", "Sprinter", "Hayabusa", "Gixxer"],
  United: ["US 70", "US 100", "US 125", "Scooty 100"],
  "Road Prince": ["RP 70", "RP 110", "Wego 150", "Robinson 150", "Jackpot 70"],
  "Super Power": ["SP 70", "SP 125", "Archi 150"],
  "Unique": ["UD 70", "UD 100", "UD 125"],
  "Super Star": ["SS 70", "SS 125"],
  "Hi Speed": ["Alpha 100", "Infinity 150", "SR 70"],
  "Crown": ["CR 70", "Lifan 150"],
  "Ravi": ["Piaggio 70", "Storm 125", "Premium 70"],
  "Zongshen": ["ZS 150", "RX3"],
  "Benelli": ["TNT 150", "TRK 251", "Leoncino"],
  "Kawasaki": ["Ninja 250", "Ninja 400", "Z800"],
  "Vespa": ["Primavera", "Sprint"],
  "Jolta Electric": ["JE-70D", "JE-Pro", "JE-Scooty"],
  "Evee": ["C1 Air", "Nisa", "S1"],
  "Metro": ["MR 70", "T9 Sports"],
  "Eagle": ["DG 70", "DG 125"],
};

export const PROVINCE_CITIES: Record<string, string[]> = {
  Punjab: ["Lahore", "Faisalabad", "Rawalpindi", "Multan", "Gujranwala", "Sialkot", "Bahawalpur", "Sargodha", "Sheikhupura", "Gujrat", "Sahiwal", "Jhang", "Rahim Yar Khan", "Kasur", "Okara", "Wah Cantt", "Dera Ghazi Khan", "Chiniot", "Kamoke", "Mandi Bahauddin", "Jhelum", "Sadiqabad", "Khanewal", "Hafizabad", "Muzaffargarh", "Khanpur", "Gojra", "Burewala", "Vehari", "Attock", "Chakwal", "Narowal", "Mianwali", "Bhakkar", "Layyah", "Pakpattan", "Toba Tek Singh", "Lodhran", "Murree", "Taxila"],
  Sindh: ["Karachi", "Hyderabad", "Sukkur", "Larkana", "Nawabshah", "Mirpur Khas", "Jacobabad", "Shikarpur", "Khairpur", "Dadu", "Thatta", "Badin", "Tando Adam", "Tando Allahyar", "Umerkot", "Ghotki", "Sanghar"],
  "Khyber Pakhtunkhwa": ["Peshawar", "Mardan", "Abbottabad", "Swat", "Mingora", "Kohat", "Dera Ismail Khan", "Mansehra", "Nowshera", "Charsadda", "Swabi", "Bannu", "Haripur", "Chitral", "Dir", "Malakand"],
  Balochistan: ["Quetta", "Gwadar", "Turbat", "Khuzdar", "Hub", "Chaman", "Sibi", "Zhob", "Loralai"],
  Islamabad: ["Islamabad"],
  "Azad Kashmir": ["Muzaffarabad", "Mirpur", "Kotli", "Bhimber", "Rawalakot"],
  "Gilgit-Baltistan": ["Gilgit", "Skardu", "Hunza"],
};

export const CITIES: string[] = [...new Set(Object.values(PROVINCE_CITIES).flat())].sort((a, b) => a.localeCompare(b));

/** The biggest markets first in short lists. */
export const MAJOR_CITIES = ["Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad", "Multan", "Peshawar", "Gujranwala", "Sialkot", "Hyderabad", "Quetta", "Abbottabad"];

export const PART_CATEGORIES = [
  "Engine Oil", "Filters", "Brakes", "Batteries", "Tyres & Wheels", "Lights", "Suspension", "Engine Parts", "Body Parts",
  "Interior", "Exterior Accessories", "Electronics", "Car Care", "Helmets & Riding Gear", "Bike Parts", "Tools", "Other",
] as const;

export function modelsFor(kind: Kind, make: string) {
  const book = kind === "bike" ? BIKE_MODELS : CAR_MODELS;
  const key = Object.keys(book).find((k) => k.toLowerCase() === make.trim().toLowerCase());
  return key ? book[key] : [];
}

export function makesFor(kind: Kind, extra: string[] = []) {
  const base = Object.keys(kind === "bike" ? BIKE_MODELS : CAR_MODELS);
  const seen = new Set(base.map((m) => m.toLowerCase()));
  const more = extra.filter((m) => m && !seen.has(m.toLowerCase()) && seen.add(m.toLowerCase()));
  return [...base, ...more].sort((a, b) => a.localeCompare(b));
}

/** Year options for dropdowns, newest first. */
export function yearOptions(from = 1985) {
  const now = new Date().getFullYear() + 1;
  return Array.from({ length: now - from + 1 }, (_, i) => now - i);
}
