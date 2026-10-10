import { createItinerary, destinations, Destination, findDestination, Place, udaipurHeritageCircuit } from "@/lib/travel-data";

export type AssistantMessage = { role: "user" | "assistant"; content: string };
export type AssistantInput = {
  message?: string;
  destination?: string;
  days?: number;
  budget?: number;
  travellers?: number;
  style?: string;
  history?: AssistantMessage[];
};

export type LocalAssistantResponse = {
  answer: string;
  destination: string;
  itinerary: ReturnType<typeof createItinerary>;
  intent: string;
};

const hindiNames: Record<string, string> = {
  "उदयपुर": "udaipur",
  "जयपुर": "jaipur",
  "जैसलमेर": "jaisalmer",
  "जोधपुर": "jodhpur",
  "रणथंभौर": "ranthambore",
  "रणथंबोर": "ranthambore",
  "पुष्कर": "pushkar",
  "माउंट आबू": "mount-abu",
  "माउण्ट आबू": "mount-abu",
  "बीकानेर": "bikaner",
  "चित्तौड़गढ़": "chittorgarh",
  "चित्तौड़": "chittorgarh",
  "कुंभलगढ़": "kumbhalgarh",
  "कुम्भलगढ़": "kumbhalgarh",
  "अजमेर": "ajmer",
};

const hindiDayWords: Record<string, number> = {
  "एक": 1,
  "दो": 2,
  "तीन": 3,
  "चार": 4,
  "पाँच": 5,
  "पांच": 5,
  "छह": 6,
  "सात": 7,
};

const hinglishDayWords: Record<string, number> = {
  ek: 1,
  do: 2,
  teen: 3,
  char: 4,
  chaar: 4,
  paanch: 5,
  cheh: 6,
  chhe: 6,
  saat: 7,
};

function text(input: AssistantInput) {
  return input.message?.trim().replace(/\s+/g, " ").slice(0, 1000) || "";
}

function isHindi(value: string) {
  return /[\u0900-\u097F]/.test(value) || /\b(kya|kaise|mujhe|mein|karun|dekhna|ghoomna|ghumna|batao|chahiye|kitna|sasta|jagah|raasta|rasta|khana|hotel|din)\b/i.test(value);
}

function resolveDestination(input: AssistantInput, message: string) {
  const normalized = message.toLowerCase();
  const hindiMatch = Object.entries(hindiNames).find(([name]) => normalized.includes(name));
  if (hindiMatch) return destinations.find((item) => item.id === hindiMatch[1]) ?? destinations[0];
  const named = destinations.find((item) => normalized.includes(item.name.toLowerCase()) || normalized.includes(item.id.replace("-", " ")));
  if (named) return named;
  return findDestination(input.destination || "Udaipur");
}

function requestedDays(message: string, fallback: number) {
  const match = message.match(/(?:^|\s)([1-7])\s*(?:[-\s]?(?:day|days|din|दिन))/i);
  if (match) return Number(match[1]);
  const word = Object.entries(hindiDayWords).find(([name]) => message.includes(name) && /दिन|din/i.test(message));
  if (word) return word[1];
  const hinglishWord = Object.entries(hinglishDayWords).find(([name]) => new RegExp(`\\b${name}\\s*(?:din|day|days)`, "i").test(message));
  if (hinglishWord) return hinglishWord[1];
  if (/one day|एक दिन|ek din/i.test(message)) return 1;
  return Math.max(1, Math.min(Number(fallback) || 3, 7));
}

function requestedBudget(message: string, fallback: number) {
  const compactValue = message.match(/(?:₹|rs\.?|inr)\s*(\d+(?:\.\d+)?)\s*k\b|\b(\d+(?:\.\d+)?)\s*k\s*(?:budget|rupees?|रुपये)/i);
  const currencyValue = message.match(/(?:₹|rs\.?|inr)\s*([\d,]+)/i)?.[1] || message.match(/([\d,]+)\s*(?:rupees?|रुपये|rs\.?|inr|रू)/i)?.[1];
  const compact = compactValue?.[1] || compactValue?.[2];
  const value = compact ? Number(compact) * 1000 : currencyValue ? Number(currencyValue.replace(/,/g, "")) : 0;
  return Math.max(1000, Math.min(value || fallback || 15000, 1_000_000));
}

function titleFor(place: Place, hindiLang: boolean) {
  return `${place.name} — ${place.rating.toFixed(1)}★ (${place.price})`;
}

function takePlaces(destination: Destination, kind: Place["kind"], amount: number) {
  return destination.places.filter((place) => place.kind === kind).slice(0, amount);
}

function list(items: string[]) {
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}

function buildPlacesAnswer(destination: Destination, hindiLang: boolean) {
  const places = takePlaces(destination, "attraction", 7);
  const activities = takePlaces(destination, "activity", 2);
  if (hindiLang) {
    return `✨ **${destination.name} की बेहतरीन जगहें:**\n\n${list(places.map((place) => `${titleFor(place, true)} — ${place.description}`))}${activities.length ? `\n\n🎯 **खास अनुभव:**\n${list(activities.map((place) => `${place.name} (${place.price})`))}` : ""}\n\n💡 *रास्ता देखने के लिए Trip Map खोलें और अपनी स्टार्टिंग लोकेशन चुनें।*`;
  }
  return `✨ **Best places to visit in ${destination.name}:**\n\n${list(places.map((place) => `${titleFor(place, false)} — ${place.description}`))}${activities.length ? `\n\n🎯 **Experiences:**\n${list(activities.map((place) => `${place.name} (${place.price})`))}` : ""}\n\n💡 *Open Trip map to choose your starting location and calculate your road route.*`;
}

function buildHotelsAnswer(destination: Destination, hindiLang: boolean) {
  const hotels = takePlaces(destination, "hotel", 6);
  if (!hotels.length) return hindiLang ? `🏨 ${destination.name} के लिए होटलों की सूची तैयार हो रही है। अपनी पसंद और बजट बताएं!` : `🏨 Curated hotel options are being gathered for ${destination.name}. Tell me your budget or travel style!`;
  return hindiLang
    ? `🏨 **${destination.name} में रुकने के लिए बेहतरीन विकल्प:**\n\n${list(hotels.map((hotel) => `${titleFor(hotel, true)} — ${hotel.tags.join(", ")}\n   ${hotel.description}`))}\n\n💡 *बुकिंग से पहले वर्तमान दर और रद्दीकरण नीतियाँ ज़रूर जांच लें।*`
    : `🏨 **Recommended stays in ${destination.name}:**\n\n${list(hotels.map((hotel) => `${titleFor(hotel, false)} — ${hotel.tags.join(", ")}\n   ${hotel.description}`))}\n\n💡 *Check current seasonal prices, ratings, and cancellation terms before booking.*`;
}

function buildFoodAnswer(destination: Destination, hindiLang: boolean) {
  const restaurants = takePlaces(destination, "restaurant", 5);
  if (hindiLang) {
    return `🍽️ **${destination.name} के मशहूर व्यंजन:**\n\n${list(destination.foods.map((food) => food))}${restaurants.length ? `\n\n🍴 **मशहूर रेस्टोरेंट और कैफे:**\n${list(restaurants.map((r) => `${titleFor(r, true)} — ${r.tags.join(", ")}`))}` : ""}`;
  }
  return `🍽️ **Must-try food in ${destination.name}:**\n\n${list(destination.foods)}${restaurants.length ? `\n\n🍴 **Top restaurant & café picks:**\n${list(restaurants.map((r) => `${titleFor(r, false)} — ${r.tags.join(", ")}`))}` : ""}\n\nTell me if you prefer pure vegetarian, rooftop, or lakeside dining!`;
}

function buildPackingAnswer(destination: Destination, days: number, hindiLang: boolean) {
  const rain = Number.parseInt(destination.rain, 10);
  const weather = destination.condition.toLowerCase();
  const weatherItems = rain >= 20 || weather.includes("cloud") ? ["compact rain jacket", "water-resistant pouch"] : weather.includes("cool") || weather.includes("mountain") ? ["light jacket", "evening shawl"] : ["sunscreen", "sunglasses / hat"];
  if (hindiLang) {
    return `🎒 **${destination.name} (${days} दिन) के लिए पैकिंग लिस्ट:**\n\n👕 कपड़े: आरामदायक कॉटन या ब्रीथेबल कपड़े, 1 गर्म/हल्की लेयर\n📄 दस्तावेज़: पहचान पत्र (ID), टिकट्स, होटल कन्फर्मेशन\n📱 इलेक्ट्रॉनिक्स: फ़ोन चार्जर, पावर बैंक, ऑफ़लाइन मैप\n💊 स्वास्थ्य: सामान्य दवाइयां व फर्स्ट-एड किट\n☀️ मौसम: ${destination.temperature}, ${destination.condition} (${weatherItems.join(", ")})`;
  }
  return `🎒 **${days}-day packing checklist for ${destination.name}:**\n\n👕 **Clothing:** Breathable daywear, 1 light evening layer, sturdy walking shoes\n📄 **Documents:** Photo ID, tickets, booking vouchers\n📱 **Electronics:** Phone charger, power bank, downloaded offline maps\n💊 **Health:** Personal medicines, hydration bottle, sunscreen\n☀️ **Weather notes:** ${destination.temperature}, ${destination.condition} — remember to pack ${weatherItems.join(" and ")}.`;
}

function buildBudgetAnswer(destination: Destination, days: number, budget: number, travellers: number, hindiLang: boolean) {
  const totalDays = Math.max(1, days);
  const daily = Math.round(budget / totalDays);
  const amounts = {
    stay: Math.round(budget * 0.38),
    transport: Math.round(budget * 0.20),
    food: Math.round(budget * 0.20),
    activities: Math.round(budget * 0.12),
    buffer: Math.round(budget * 0.10),
  };
  const perPerson = Math.round(budget / Math.max(1, travellers));
  return `💰 **${destination.name} Trip Budget Plan:**\n\n• **Total:** ₹${budget.toLocaleString("en-IN")} (${totalDays} days, ${travellers} traveler${travellers > 1 ? "s" : ""})\n• **Daily estimate:** ₹${daily.toLocaleString("en-IN")}/day\n• **Per person:** ₹${perPerson.toLocaleString("en-IN")}\n\n🏨 **Stay (38%):** ₹${amounts.stay.toLocaleString("en-IN")}\n🚗 **Transport (20%):** ₹${amounts.transport.toLocaleString("en-IN")}\n🍽️ **Food (20%):** ₹${amounts.food.toLocaleString("en-IN")}\n🎟️ **Activities & Entry (12%):** ₹${amounts.activities.toLocaleString("en-IN")}\n🛡️ **Safety / Buffer (10%):** ₹${amounts.buffer.toLocaleString("en-IN")}`;
}

function buildSafetyAnswer(destination: Destination, hindiLang: boolean) {
  return `🛡️ **Safety & Travel Advice for ${destination.name}:**\n\n${list(destination.tips)}\n\n• Always use licensed or app-based transport after dark.\n• Keep copies of important IDs offline.\n• For immediate emergencies in India, call **112** (Police & Medical).`;
}

function buildWeatherAnswer(destination: Destination, hindiLang: boolean) {
  return `🌤️ **${destination.name} Weather Outlook:**\n\n• Current: **${destination.temperature}**, ${destination.condition}\n• Humidity: ${destination.humidity} | Wind: ${destination.wind} | Rain: ${destination.rain}\n• Best travel season: **${destination.bestTime}**\n\nIdeal for sightseeing and walking tours!`;
}

function buildRouteAnswer(destination: Destination, hindiLang: boolean) {
  return `🗺️ **Navigating to ${destination.name}:**\n\n1. Open the **Trip Map** tool in TravelMate.\n2. Tap **Use my location** or pick your starting city.\n3. TravelMate automatically calculates total driving distance, estimated road time, and places along the way.\n4. Tap **Open turn-by-turn maps** for turn-by-turn navigation in Google Maps.`;
}

function buildItineraryAnswer(destination: Destination, days: number, style: string, hindiLang: boolean) {
  const itinerary = createItinerary(destination.name, days, style);
  const dayLines = itinerary.map((day) => `**Day ${day.day}: ${day.title}**\n${day.items.map((item) => `• ${item.time} — ${item.title} (${item.meta})`).join("\n")}`).join("\n\n");
  return `🗓️ **${days}-Day ${style} Itinerary for ${destination.name}:**\n\n${dayLines}\n\n*You can save and customize this schedule directly in your Trip Workspace.*`;
}

function buildCircuitAnswer(destination: Destination, hindiLang: boolean) {
  const circuit = udaipurHeritageCircuit;
  if (hindiLang) {
    return `🚶 **${circuit.title} (हेरिटेज वॉकिंग सर्किट):**\n\n${circuit.description}\n\n• **दूरी व समय:** ${circuit.walkingDistanceEst || "~1.8 किमी"}, लगभग ${circuit.walkingDurationEst || "2.5 – 3 घंटे"}\n\n📍 **क्रमवार स्टॉप्स (Ordered Stops):**\n${circuit.stops.map((s) => `${s.stepNumber}. **${s.name}** (${s.category}) — ${s.description}`).join("\n")}\n\n🌿 **पैदल यात्रा व पर्यावरण नियम:**\n${circuit.walkingTips.map((tip) => `• ${tip}`).join("\n")}\n\n🗺️ *आप TravelMate के इंटरैक्टिव Trip Map में यह पूरा सर्किट क्रमवार स्टॉप्स और वॉकिंग रूट के साथ देख सकते हैं।*`;
  }
  return `🚶 **${circuit.title} (Curated Heritage Walk):**\n\n${circuit.description}\n\n• **Circuit Scale:** ${circuit.walkingDistanceEst || "~1.8 km"} • ${circuit.walkingDurationEst || "2.5 – 3 hours on foot"}\n\n📍 **Ordered Heritage & Artisan Stops:**\n${circuit.stops.map((s) => `${s.stepNumber}. **${s.name}** (${s.category})\n   ${s.description}${s.heritageNotes ? `\n   *Heritage Context:* ${s.heritageNotes}` : ""}`).join("\n\n")}\n\n🌿 **Walking Etiquette & Lake Preservation:**\n${circuit.walkingTips.map((tip) => `• ${tip}`).join("\n")}\n\n🗺️ *Explore the full route line and ordered stops interactively by opening the **Trip Map** and selecting "Old Udaipur Heritage & Artisan Circuit".*`;
}

function buildCrowdPlanningAnswer(destination: Destination, hindiLang: boolean) {
  const placesWithCrowd = destination.places.filter((p) => p.crowdLevel);
  const lowCrowd = placesWithCrowd.filter((p) => p.crowdLevel === "low");
  const moderateCrowd = placesWithCrowd.filter((p) => p.crowdLevel === "moderate");
  const peakCrowd = placesWithCrowd.filter((p) => p.crowdLevel === "peak");

  if (hindiLang) {
    return `⏱️ **उदयपुर भीड़-प्रबंधन योजना (Curated Planning Estimates):**\n*(नोट: यह केवल क्यूरेटेड योजना अनुमान हैं, लाइव क्राउड डेटा नहीं)*\n\n🟢 **कम भीड़ वाली जगहें (Low Crowd):**\n${lowCrowd.map((p) => `• **${p.name}** — ${p.recommendedVisitTime ? `सुझाया गया समय: ${p.recommendedVisitTime}` : p.description}`).join("\n")}\n\n🟡 **मध्यम भीड़ वाली जगहें (Moderate Crowd):**\n${moderateCrowd.map((p) => `• **${p.name}** — शांत समय: ${p.recommendedVisitTime || "सुबह 10:30 से पहले"}; पीक: ${p.peakHours || "दोपहर"}`).join("\n")}\n\n🔴 **पीक ऑवर्स व विकल्प (Peak Hours & Relief):**\n${peakCrowd.map((p) => `• **${p.name}:** पीक ऑवर्स ${p.peakHours || "दोपहर"}\n  💡 *राहत सुझाव:* ${p.crowdReliefSuggestion || `सुबह जल्दी (09:00 AM) जाएँ।`}`).join("\n")}\n\n💡 *सलाह: सिटी पैलेस और जगदीश मंदिर सुबह 08:30–10:30 AM के बीच घूमें ताकि दोपहर की भीड़ से बचा जा सके।*`;
  }

  return `⏱️ **Crowd-Aware Visit Planning for ${destination.name}:**\n*(Note: These are curated planning estimates, not live crowd data)*\n\n🟢 **Low-Crowd Gems (Quiet & Peaceful):**\n${lowCrowd.map((p) => `• **${p.name}** (${p.location})\n  *Best visit window:* ${p.recommendedVisitTime || "Morning to early afternoon"}\n  *Relief note:* ${p.crowdReliefSuggestion || p.description}`).join("\n\n")}\n\n🟡 **Moderate-Crowd Locations:**\n${moderateCrowd.map((p) => `• **${p.name}** — Recommended: ${p.recommendedVisitTime || "Early morning"}; Peak: ${p.peakHours || "Midday"}`).join("\n")}\n\n🔴 **Peak-Hours & Relief Strategies:**\n${peakCrowd.map((p) => `• **${p.name}**\n  *Peak window:* ${p.peakHours || "Midday"}\n  *Recommended time:* ${p.recommendedVisitTime || "Opening hour"}\n  *💡 Try a quieter time:* ${p.crowdReliefSuggestion || "Visit right at opening or dusk."}`).join("\n\n")}\n\n💡 *Tip: Schedule major landmarks like City Palace right at 09:00 AM opening, visit artisan studios midday, and enjoy Ambrai Ghat at dawn for tranquil lake reflections.*`;
}

function buildArtisanAnswer(destination: Destination, hindiLang: boolean) {
  const craftPlaces = destination.places.filter((p) => p.craftCategory || p.tags.some((t) => /artisan|craft|miniature|textile|handicraft/i.test(t)));
  if (hindiLang) {
    return `🎨 **मेवाड़ की पारंपरिक हस्तकला और कारीगर धरोहर:**\n\n• **मेवाड़ मिनिएचर पेंटिंग व पिछवाई (जगदीश चौक):** 17वीं सदी की दरबारी चित्रकला परंपरा। कलाकार प्राकृतिक पत्थरों के रंग और हस्तनिर्मित वासली कागज पर काम करते हैं।\n• **पारंपरिक वस्त्र व बंधेज (बड़ा बाज़ार):** 16वीं सदी का ऐतिहासिक बाजार, प्रसिद्ध बंधेज (टाई-डाई), मोजरी और क्षेत्रीय हैंडलूम।\n• **राजस्थानी कठपुतली व लोक कला (बागोर की हवेली):** 138 कमरों की हवेली में लोक कला, कांच की मोज़ेक और पारंपरिक कठपुतली प्रदर्शन।\n• **शिल्पग्राम (हस्तशिल्प व जनजातीय कला):** 70 एकड़ का ग्रामीण कला केंद्र, जहाँ टेराकोटा, मिट्टी के बर्तन और धातुशिल्प सीधे कारीगरों द्वारा प्रदर्शित होते हैं।\n\n🤝 **कारीगरों के समर्थन का सही तरीका:**\n• बिचौलियों और गाइड कमीशन से बचकर जगदीश चौक व शिल्पग्राम के स्टूडियो से सीधे खरीदारी करें।\n• किसी भी फर्जी रेटिंग या अनधिकृत बिचौलियों के बजाय सीधे कलाकारों से संवाद करें।`;
  }

  return `🎨 **Traditional Mewar Crafts & Living Artisan Heritage in ${destination.name}:**\n\n${craftPlaces.map((p) => `• **${p.name}** (${p.craftCategory || "Artisan & Crafts"})\n  *Location:* ${p.location}\n  *Craft Context:* ${p.description}\n  ${p.heritageNotes ? `*Heritage Lineage:* ${p.heritageNotes}\n  ` : ""}${p.localSourcing ? `*Sourcing & Materials:* ${p.localSourcing}\n  ` : ""}*Best interaction window:* ${p.recommendedVisitTime || "10:30 AM – 01:30 PM"}`).join("\n\n")}\n\n🤝 **How to Fairly Support Local Artisans:**\n• **Direct Patronage:** Purchase miniature paintings, Pichwai artworks, and bandhani textiles directly from artist-run studios in Jagdish Chowk or Shilpgram without middlemen commissions.\n• **Sustainable Materials:** Authentic Mewar miniatures utilize handmade wasli paper and crushed mineral/vegetable pigments that endure for centuries.\n• **Respect & Dialogue:** Visit studios during unhurried morning hours (10:30 AM – 01:30 PM) to watch natural pigment grinding and needle-fine camel hair brushwork.`;
}

function buildSustainableAnswer(destination: Destination, hindiLang: boolean) {
  if (hindiLang) {
    return `🌱 **उदयपुर सस्टेनेबल और पर्यावरण-हितैषी पर्यटन:**\n\n🍽️ **पर्यावरण-अनुकूल खानपान:**\n• **Millets of Mewar (हनुमान घाट):** स्थानीय मोटे अनाज (बाजरा, ज्वार, रागी) और जैविक भोजन। काँच की बोतलों में पानी और शून्य सिंगल-यूज़ प्लास्टिक।\n• **Syah Udaipur:** फार्म-टू-टेबल फाइन डाइनिंग, स्थानीय ताजी उपज पर आधारित।\n\n🏨 **सस्टेनेबल हेरिटेज स्टे:**\n• **Chandra Vilas Heritage Stay:** पारंपरिक पुरानी हवेली का संरक्षण, स्थानीय बेकर्स और किराना व्यापारियों से सीधी खरीद।\n• **Taj Lake Palace & Leela Palace:** झील संरक्षण जल-प्रबंधन प्रोटोकॉल और इलेक्ट्रिक नाव आवागमन।\n\n💧 **पिछोला झील और प्रकृति संरक्षण:**\n• अपनी रीफिलेबल पानी की बोतल रखें; घाटों पर प्लास्टिक व कचरा न डालें।\n• संकरी गलियों में पैदल या ई-रिक्शा का उपयोग करें ताकि प्रदूषण न हो।`;
  }

  return `🌱 **Sustainable Tourism & Eco-Conscious Stays in ${destination.name}:**\n\n🍽️ **Farm-to-Table & Eco-Friendly Dining:**\n• **Millets of Mewar (Hanuman Ghat):** Pioneer of drought-resilient indigenous millets (bajra, jowar, ragi) sourced from regional organic collectives. Filtered water served in glass carafes; zero single-use plastic takeaway containers.\n• **Syah Udaipur:** Refined farm-to-table dining celebrating regional Rajasthan agricultural seasonality.\n• **Jaajam Restaurant:** Authentic Mewari culinary traditions with regional whole spices and lentils.\n\n🏨 **Heritage Conservation & Responsible Hospitality:**\n• **Chandra Vilas Heritage Stay:** Intimate haveli architectural conservation; sources directly from neighborhood Old City merchants.\n• **Taj Lake Palace & The Leela Palace:** Closed-loop lake water preservation protocols and electric passenger boat transfers.\n• **Trident & The Oberoi Udaivilas:** Rainwater percolation catchment pits and indigenous flora botanical reserves.\n\n💧 **Essential Eco-Practices for Travelers:**\n• **Lake Pichola Preservation:** Udaipur's lakes are vital drinking water ecosystems. Carry a reusable flask and take all packaging to municipal bins.\n• **Low-Impact Mobility:** Choose walking or electric e-rickshaws through Old City pols to minimize emissions and preserve historic stone streets.`;
}

function buildResponsibleAnswer(destination: Destination, hindiLang: boolean) {
  const guidelines = destination.responsibleTravelGuidelines || destination.tips;
  if (hindiLang) {
    return `🤝 **उदयपुर जिम्मेदार पर्यटन और सांस्कृतिक मर्यादा दिशानिर्देश:**\n\n${guidelines.map((g, i) => `${i + 1}. ${g}`).join("\n\n")}\n\n• **झील संरक्षण:** पिछोला व फतेहसागर में कभी भी प्लास्टिक या कचरा न डालें।\n• **मंदिरों का सम्मान:** जगदीश मंदिर की सीढ़ियों पर जूते उतारें और शालीन कपड़े पहनें।\n• **स्थानीय कारीगर:** हस्तशिल्प सीधे स्थानीय कलाकारों से खरीदें।\n• **पैदल यात्रा:** पुरानी नगरी की संकरी गलियों में पैदल या ई-रिक्शा चलें।`;
  }

  return `🤝 **Responsible Tourism Guidelines & Cultural Etiquette for ${destination.name}:**\n\n${guidelines.map((g, i) => `${i + 1}. **${g}**`).join("\n\n")}\n\n• **Freshwater Resource Sanctity:** Lake Pichola and Fateh Sagar are living community reservoirs. Zero plastic, wrappers, or soaps in ghat waters.\n• **Temple & Sacred Space Protocol:** Remove footwear at the base of Jagdish Temple stone stairs; dress modestly with shoulders and knees covered; walk clockwise (pradakshina).\n• **Direct Artisan Fair-Trade:** Support master miniature artists and weavers directly in studio workshops without paying tourist middleman commissions.\n• **Gentle Pedestrian Mobility:** Old City stone lanes were built for pedestrians and horses; walk or hire battery-operated e-rickshaws to prevent gridlock.`;
}

function buildHeritagePlaceDetailAnswer(destination: Destination, place: Place, hindiLang: boolean) {
  if (hindiLang) {
    return `🏛️ **${place.name} — ऐतिहासिक व सांस्कृतिक विवरण:**\n\n${place.description}\n\n📜 **विरासत का इतिहास (Heritage Context):**\n${place.heritageNotes || "मेवाड़ की ऐतिहासिक वास्तुकला और सांस्कृतिक परंपरा का जीवंत प्रतीक।"}\n\n⏱️ **भीड़ प्रबंधन अनुमान (Curated Planning Estimate):**\n• स्तर: **${place.crowdLevel ? (place.crowdLevel === "low" ? "कम भीड़ (Low Crowd)" : place.crowdLevel === "moderate" ? "मध्यम भीड़ (Moderate)" : "पीक ऑवर्स (Peak)") : "सामान्य"}**\n• अनुशंसित समय: **${place.recommendedVisitTime || "सुबह 09:00 AM"}**\n${place.peakHours ? `• पीक ऑवर्स: ${place.peakHours}\n` : ""}${place.crowdReliefSuggestion ? `• 💡 राहत सुझाव: ${place.crowdReliefSuggestion}\n` : ""}\n📍 **स्थान:** ${place.location} (${place.distance || "Old City"})\n🎟️ **प्रवेश:** ${place.price}${place.sustainable ? "\n🌱 **सस्टेनेबिलिटी:** पारंपरिक वास्तुकला संरक्षण" : ""}`;
  }

  return `🏛️ **${place.name} — Heritage & Practical Visitor Guide:**\n\n${place.description}\n\n📜 **Cultural Significance & Historical Context:**\n${place.heritageNotes || "An essential landmark of Mewar royal architecture and regional heritage."}\n\n⏱️ **Curated Planning Estimates (Crowd Timing):**\n• Planning Estimate: **${place.crowdLevel ? (place.crowdLevel === "low" ? "Low Crowd" : place.crowdLevel === "moderate" ? "Moderate Crowd" : "Peak Hours") : "Curated Guide"}**\n• Recommended Visit Time: **${place.recommendedVisitTime || "Early morning hours"}**\n${place.peakHours ? `• Peak Hours to Avoid: **${place.peakHours}**\n` : ""}${place.crowdReliefSuggestion ? `• 💡 Actionable Relief Tip: *${place.crowdReliefSuggestion}*\n` : ""}\n${place.craftCategory ? `🎨 **Artisan & Craft Lineage:** ${place.craftCategory}${place.localSourcing ? ` — ${place.localSourcing}` : ""}\n\n` : ""}${place.sustainable ? `🌱 **Sustainable Practice:** ${place.sustainabilityTags?.join(", ") || "Heritage preservation"}${place.plasticReduction ? `\n💧 *Lake Protection:* ${place.plasticReduction}` : ""}\n\n` : ""}📍 **Location:** ${place.location} (${place.price})\n⭐ **Rating:** ${place.rating.toFixed(1)}★ (${place.reviews.toLocaleString("en-IN")} reviews)\n💡 *You can also add this stop to your personalized itinerary in the Trip Planner.*`;
}

function buildGeneralAnswer(destination: Destination, hindiLang: boolean) {
  if (destination.id === "udaipur") {
    if (hindiLang) {
      return `👋 नमस्ते! मैं **उदयपुर हेरिटेज व सस्टेनेबल टूरिज्म साथी (Companion)** हूँ!\n\nमैं आपकी सहायता कर सकता हूँ:\n• 🏛️ **विरासत व इतिहास:** सिटी पैलेस, जगदीश मंदिर, बागोरे की हवेली\n• 🎨 **पारंपरिक कला व कारीगर:** जगदीश चौक मिनिएचर पेंटिंग, पिछवाई, बड़ा बाज़ार बंधेज\n• 🚶 **वॉकिंग सर्किट:** 'Old Udaipur Heritage & Artisan Circuit' (5 स्टॉप्स)\n• ⏱️ **भीड़ प्रबंधन:** कम भीड़ के समय व यात्रा सुझाव (क्यूरेटेड अनुमान)\n• 🌱 **सस्टेनेबल टूरिज्म:** मिलेट्स ऑफ मेवाड़, सस्टेनेबल स्टे व झील संरक्षण\n\nमुझसे पूछें: *"वॉकिंग सर्किट बताएं"*, *"कारीगर कहाँ मिलेंगे?"*, *"किस समय भीड़ कम रहती है?"*, या *"सिटी पैलेस का इतिहास"*।\n(आप 3-दिन का प्लान, बजट या पैकिंग के बारे में भी पूछ सकते हैं!)`;
    }
    return `👋 Welcome! I am your **Udaipur & Rajasthan Heritage Travel Companion**.\n\nI can help you discover and plan:\n• 🏛️ **Heritage & Culture:** City Palace, Jagdish Temple, Bagore Ki Haveli, Amber Fort, Mehrangarh\n• 🎨 **Artisan & Crafts:** Authentic Mewar miniature painting, Pichwai studios, Sanganeri block printing, Mojari crafts\n• 🚶 **Old Udaipur Heritage & Artisan Circuit:** 5-stop curated walking route with map guidance\n• ⏱️ **Curated Crowd Planning:** Low-crowd gems and quiet visit windows (curated estimates)\n• 🌱 **Sustainable Tourism:** Eco-friendly dining, heritage stays, and lake/desert conservation\n\nTry asking me:\n• *"Guide me through the Old Udaipur Heritage Circuit"*\n• *"Which places have low crowds or best visit times?"*\n• *"Where can I find traditional Rajasthan crafts & artisans?"*\n• *"Tell me about City Palace or Amber Fort history and visiting tips"*\n• *"Eco-friendly dining and heritage preservation guidelines"*\n\nYou can also ask for multi-day itineraries and budget breakdowns for any Rajasthan destination!`;
  }

  const attractions = takePlaces(destination, "attraction", 3).map((place) => place.name).join(", ");
  const food = destination.foods.slice(0, 3).join(", ");
  if (hindiLang) {
    return `👋 मैं **${destination.name}** की यात्रा योजना में आपकी मदद के लिए तैयार हूँ!\n\n• **प्रमुख स्थल:** ${attractions}\n• **प्रसिद्ध खानपान:** ${food}\n• **मौसम:** ${destination.temperature}, ${destination.condition}\n• **बजट गाइड:** ${destination.budget}\n\nमुझसे पूछें: *"3 दिन का प्लान बनाएं"*, *"घूमने की जगहें"*, या *"₹15,000 का बजट"*।`;
  }
  return `👋 I am ready to help you plan **${destination.name}**!\n\n• **Highlights:** ${attractions}\n• **Must-try food:** ${food}\n• **Weather:** ${destination.temperature}, ${destination.condition}\n• **Guide budget:** ${destination.budget}\n\nTry asking me: *"Plan a 3-day trip"*, *"Best places to visit"*, *"What local food should I try?"*, or *"Give me a ₹15,000 budget breakdown"*.`;
}

function buildSustainableHeritageItineraryAnswer(destination: Destination, days: number, style: string, hindiLang: boolean) {
  const customItinerary = [
    {
      day: 1,
      title: "Sustainable Heritage & Living Crafts in Udaipur",
      items: [
        {
          id: "day-1-visit-palace",
          time: "09:00",
          title: "City Palace (Early Opening)",
          meta: "Old City • 1.2 km • Low-Crowd Strategy",
          location: "Old City",
          durationMinutes: 120,
          estimatedCost: 400,
          notes: "Visit right at 09:00 AM opening to explore royal museum galleries before the 11:00 AM peak hours.",
          type: "visit" as const,
        },
        {
          id: "day-1-visit-temple",
          time: "11:15",
          title: "Jagdish Temple & Sacred Stone Carvings",
          meta: "Jagdish Chowk • Maha-Maru Architecture",
          location: "Jagdish Chowk, Old City",
          durationMinutes: 45,
          estimatedCost: 0,
          notes: "Remove footwear at base of stairs; admire 17th-century stone carvings at quiet morning pace.",
          type: "visit" as const,
        },
        {
          id: "day-1-activity-crafts",
          time: "12:00",
          title: "Jagdish Chowk Traditional Miniature Art & Pichwai Studios",
          meta: "Living Craft • Fair-Trade Studio Visit",
          location: "Jagdish Chowk, Old City",
          durationMinutes: 75,
          estimatedCost: 500,
          notes: "Unhurried interaction with Mewar master painters using natural stone pigments on handmade wasli paper.",
          type: "activity" as const,
        },
        {
          id: "day-1-food-millets",
          time: "13:30",
          title: "Millets of Mewar (Hanuman Ghat)",
          meta: "Farm-to-Table • Zero Plastic • Healthy",
          location: "Hanuman Ghat",
          durationMinutes: 75,
          estimatedCost: 450,
          notes: "Organic indigenous grains (bajra, jowar, ragi) and filtered glass carafes; zero single-use plastic.",
          type: "food" as const,
        },
        {
          id: "day-1-visit-bagore",
          time: "15:15",
          title: "Bagore Ki Haveli Folk Museum",
          meta: "Gangaur Ghat • 18th-Century Architecture",
          location: "Gangaur Ghat",
          durationMinutes: 90,
          estimatedCost: 100,
          notes: "138-room waterfront haveli museum with royal puppets and glass mosaic work ahead of evening crowds.",
          type: "visit" as const,
        },
        {
          id: "day-1-visit-ambrai",
          time: "17:15",
          title: "Ambrai Ghat Waterfront & Dusk Reflections",
          meta: "Lake Pichola • Water Conservation",
          location: "Lake Pichola waterfront",
          durationMinutes: 75,
          estimatedCost: 0,
          notes: "Dusk reflections across Lake Pichola. Please carry a reusable flask and keep lake waters pristine.",
          type: "visit" as const,
        },
      ],
    },
  ];

  if (hindiLang) {
    return {
      answer: `🌿 **उदयपुर सस्टेनेबल 1-दिवसीय हेरिटेज व क्राफ्ट यात्रा योजना:**\n*(सभी क्राउड समय क्यूरेटेड योजना अनुमान हैं, लाइव डेटा नहीं)*\n\n🌅 **09:00 AM — सिटी पैलेस (सुबह की शांति):**\n• 11:00 AM से 03:30 PM के पीक समय से पहले सुबह 09:00 बजे संग्रहालय व झरोखे देखें।\n\n🏛️ **11:15 AM — जगदीश मंदिर (17वीं सदी की वास्तुकला):**\n• सीढ़ियों पर जूते उतारें; महा-मारू शैली की बारीक नक्काशी का शांत दर्शन।\n\n🎨 **12:00 PM — जगदीश चौक मिनिएचर पेंटिंग व पिछवाई स्टूडियो (पारंपरिक कला):**\n• दरबारी चित्रकारों की पीढ़ियों से सीधे संवाद; प्राकृतिक पत्थरों के रंगों व हस्तनिर्मित वासली कागज पर काम। बिना कमीशन सीधे कारीगरों का समर्थन।\n\n🍽️ **01:30 PM — मिलेट्स ऑफ मेवाड़ (हनुमान घाट — सस्टेनेबल भोजन):**\n• स्थानीय मोटे अनाज (बाजरा, ज्वार, रागी) से तैयार पौष्टिक भोजन। शून्य सिंगल-यूज़ प्लास्टिक।\n\n🏛️ **03:15 PM — बागोर की हवेली (लोक कला व संग्रहालय):**\n• 138 कमरों की हवेली, राजस्थानी कठपुतली और कांच की कलाकृतियां (शाम के शो से पहले का शांत समय)।\n\n🌅 **05:15 PM — अम्बाई घाट (जल धरोहर व गोधूलि वेला):**\n• पिछोला झील के किनारे खूबसूरत दृश्य। झील में प्लास्टिक न डालें।\n\n💡 *यह क्रम 'Old Udaipur Heritage & Artisan Circuit' के अनुरूप है। Trip Map में इसे पूरा वॉकिंग रूट के साथ देखें।*`,
      itinerary: customItinerary,
    };
  }

  return {
    answer: `🌿 **Sustainable 1-Day Heritage & Artisan Trip Plan for Udaipur:**\n*(Note: All crowd visit times are curated planning estimates, not live crowd data)*\n\n🌅 **09:00 AM – 11:00 AM: City Palace (Heritage Architecture)**\n• **Crowd-Smart Timing:** Arrive right at 09:00 AM opening to explore royal courtyards and museum galleries before the 11:00 AM – 03:30 PM peak-hour rush.\n• **Heritage Context:** Four centuries of Mewar royal architecture with passive courtyard breezes and lime-plaster construction.\n\n🏛️ **11:15 AM – 11:45 AM: Jagdish Temple (Sacred Living Heritage)**\n• **Sacred Etiquette:** Quiet morning visit. Leave footwear with caretakers at the base of the 32 stone steps; admire the 1651 Maha-Maru carved shikhara.\n\n🎨 **11:45 AM – 01:15 PM: Jagdish Chowk Traditional Miniature & Pichwai Studios (Living Craft)**\n• **Artisan Experience:** Unhurried midday interaction with master artists using natural stone pigments and fine camel-hair brushes on handmade wasli paper.\n• **Fair-Trade Support:** Purchase directly from family studios in Jagdish Chowk without tour guide commission markups.\n\n🍽️ **01:30 PM – 02:45 PM: Millets of Mewar (Hanuman Ghat — Sustainable Dining)**\n• **Farm-to-Table:** Organic indigenous grain dishes (bajra, jowar, ragi) supporting regional farming collectives.\n• **Zero Plastic:** Filtered water served in glass carafes; zero single-use plastic takeaway containers.\n\n🏛️ **03:15 PM – 04:45 PM: Bagore Ki Haveli (Folk Arts & Royal Haveli Museum)**\n• **Heritage Context:** Restored 18th-century prime minister haveli with 138 rooms, royal puppet exhibits, and glass mosaic work.\n• **Crowd Relief:** Tour museum galleries in the afternoon before the 06:30 PM Dharohar show crowd queues up.\n\n🌅 **05:15 PM – 06:30 PM: Ambrai Ghat (Water Heritage & Sunset Reflections)**\n• **Lake Pichola Preservation:** Waterfront reflections of City Palace. Carry a refillable water flask and keep freshwater ghats pristine.\n\n💡 *Tip: This route follows the pedestrian **Old Udaipur Heritage & Artisan Circuit** (~1.8 km). You can explore this route on the interactive **Trip Map** panel!*`,
    itinerary: customItinerary,
  };
}

export function buildLocalTravelAnswer(input: AssistantInput): LocalAssistantResponse {
  const message = text(input);
  const lower = message.toLowerCase();
  const hindiLang = isHindi(message);
  const destination = resolveDestination(input, message);
  const days = requestedDays(message, Number(input.days) || 3);
  const budget = requestedBudget(message, Number(input.budget) || 15000);
  const travellers = Math.max(1, Math.min(Number(input.travellers) || 1, 20));
  const style = ["Budget", "Standard", "Premium"].includes(String(input.style)) ? String(input.style) : "Standard";
  const itinerary = createItinerary(destination.name, days, style);

  let intent = "general";
  let answer = buildGeneralAnswer(destination, hindiLang);

  // Check if asking for a combined sustainable/heritage/craft itinerary
  const isSustainableHeritagePlan =
    destination.id === "udaipur" &&
    /plan|itinerary|day trip|one day|trip|schedule|योजना|प्लान/i.test(lower) &&
    (/sustainab|heritage|craft|artisan|millet|पर्यावरण|कारीगर/i.test(lower) ||
      (/crowd|quiet|भीड़/i.test(lower) && /craft|heritage|artisan|sustainab/i.test(lower)));

  if (isSustainableHeritagePlan) {
    intent = "sustainable_itinerary";
    const res = buildSustainableHeritageItineraryAnswer(destination, days, style, hindiLang);
    return { answer: res.answer, destination: destination.name, itinerary: res.itinerary, intent };
  }

  // Check if asking about a specific place in destination
  const matchedPlace = destination.places.find(
    (p) =>
      lower.includes(p.name.toLowerCase()) ||
      (p.id && lower.includes(p.id.replace(/-/g, " ")))
  );

  const isSpecificPlaceQuery =
    matchedPlace &&
    (/(?:tell me about|about|history|story|significance|timing|darshan|visit|explore|kya hai|kaisa hai|batao|details?)\b/i.test(lower) ||
      lower.replace(/[^a-z0-9\s]/g, "").trim() === matchedPlace.name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim());

  if (isSpecificPlaceQuery) {
    intent = "heritage_place";
    answer = buildHeritagePlaceDetailAnswer(destination, matchedPlace, hindiLang);
  } else if (/circuit|walking\s*(?:route|tour|circuit|walk)|heritage\s*walk|pedestrian|on foot|walking|walk|पैदल|घूमना|वॉकिंग/i.test(lower)) {
    intent = "circuit";
    answer = buildCircuitAnswer(destination, hindiLang);
  } else if (/crowd|less\s*crowded|quiet|peaceful|rush|peak\s*hour|avoid\s*crowd|timing|when\s*to\s*visit|best\s*time\s*to\s*visit|भीड़|कम भीड़|शांत/i.test(lower)) {
    intent = "crowd";
    answer = buildCrowdPlanningAnswer(destination, hindiLang);
  } else if (/craft|artisan|pichwai|miniature|bandhani|textile|handicraft|shilpgram|souvenir|painting|handmade|handloom|कारीगर|हस्तशिल्प|कला/i.test(lower)) {
    intent = "artisan";
    answer = buildArtisanAnswer(destination, hindiLang);
  } else if (/sustainab|eco|green|organic|farm[-\s]*to[-\s]*table|millet|millets|plastic|waste|पर्यावरण|इको/i.test(lower)) {
    intent = "sustainability";
    answer = buildSustainableAnswer(destination, hindiLang);
  } else if (/responsible|etiquette|respect|rules|guideline|lake\s*pichola|dress\s*code|water\s*protect|नियम|मर्यादा|आचार/i.test(lower)) {
    intent = "responsible";
    answer = buildResponsibleAnswer(destination, hindiLang);
  } else if (/pack|packing|carry|सामान/i.test(lower)) {
    intent = "packing";
    answer = buildPackingAnswer(destination, days, hindiLang);
  } else if (/avoid|safety|safe|emergency|unsafe|सुरक्षा/i.test(lower)) {
    intent = "safety";
    answer = buildSafetyAnswer(destination, hindiLang);
  } else if (/weather|rain|temperature|temp|मौसम/i.test(lower)) {
    intent = "weather";
    answer = buildWeatherAnswer(destination, hindiLang);
  } else if (/route|map|direction|distance|reach|drive|location|रास्ता/i.test(lower)) {
    intent = "route";
    answer = buildRouteAnswer(destination, hindiLang);
  } else if (/hotel|stay|accommodation|resort|होटल/i.test(lower)) {
    intent = "hotels";
    answer = buildHotelsAnswer(destination, hindiLang);
  } else if (/food|eat|restaurant|cuisine|dish|खाना/i.test(lower)) {
    intent = "food";
    answer = buildFoodAnswer(destination, hindiLang);
  } else if (/budget|cost|expense|cheap|सस्ता|रुपये|rupee|rs\.?|बजट/i.test(lower)) {
    intent = "budget";
    answer = buildBudgetAnswer(destination, days, budget, travellers, hindiLang);
  } else if (
    /plan|itinerary|schedule|day trip|one day|\b[1-7]\s*(?:day|days|din|दिन)|\b(?:ek|do|teen|char|chaar|paanch|cheh|chhe|saat)\s*din|प्लान|योजना/i.test(
      lower
    )
  ) {
    intent = "itinerary";
    answer = buildItineraryAnswer(destination, days, style, hindiLang);
  } else if (/place|attraction|sightseeing|fort|palace|best place|visit|places to|जगह/i.test(lower)) {
    intent = "places";
    answer = buildPlacesAnswer(destination, hindiLang);
  }

  return { answer, destination: destination.name, itinerary, intent };
}

export function sanitizeHistory(history: AssistantMessage[] | undefined) {
  if (!Array.isArray(history)) return [];
  return history.slice(-8).flatMap((message) => {
    if (!message || (message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string") return [];
    const content = message.content.trim().slice(0, 1400);
    return content ? [{ role: message.role, content }] : [];
  });
}
