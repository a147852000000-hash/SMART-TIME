export type RideProvider =
  | 'indrive'
  | 'uber'
  | 'careem'
  | 'didi'
  | 'bolt'
  | 'yalla-bina'
  | 'captain-egypt'
  | 'smart-line';

export type RideCategory = 'economy' | 'comfort' | 'scooter';

export interface RideInput {
  distanceKm: number;
  durationMinutes: number;
  startTime?: Date;
  category?: RideCategory;
}

export interface ProviderConfig {
  name: string;
  basePerKm: number;
  baseFare: number;
  perMinute: number;
  minimumFare: number;
  trafficSensitivity: number;
  uncertainty: number;
  comfortMultiplier?: number;
  scooterMultiplier?: number;
}

export interface RideEstimate {
  provider: RideProvider;
  name: string;
  estimatedFare: number;
  minFare: number;
  maxFare: number;
  effectivePerKm: number;
  distanceKm: number;
  durationMinutes: number;
  trafficFactor: number;
  timeFactor: number;
  category: RideCategory;
}

/*
 * السعر المرجعي لـ inDrive لمسافة 6 كم.
 * يعادل 6 جنيه/كم في الإعداد الافتراضي الحالي، ويمكن تغييره هنا لاحقًا
 * دون أي تعديل في واجهة المستخدم.
 */
export const INDRIVE_6KM_PRICE = 36;

export const RIDE_CONFIG: Record<RideProvider, ProviderConfig> = {
  indrive: {
    name: 'inDrive',
    basePerKm: INDRIVE_6KM_PRICE / 6,
    baseFare: 0,
    perMinute: 0,
    minimumFare: 0,
    trafficSensitivity: 0.25,
    uncertainty: 0.08,
  },
  uber: {
    name: 'Uber X',
    basePerKm: 4.5,
    baseFare: 12,
    perMinute: 0.55,
    minimumFare: 20,
    trafficSensitivity: 0.35,
    uncertainty: 0.12,
  },
  careem: {
    name: 'Careem Economy',
    basePerKm: 4.5,
    baseFare: 12,
    perMinute: 0.55,
    minimumFare: 20,
    trafficSensitivity: 0.35,
    uncertainty: 0.12,
  },
  didi: {
    name: 'DiDi',
    basePerKm: 4.5,
    baseFare: 12,
    perMinute: 0.55,
    minimumFare: 20,
    trafficSensitivity: 0.35,
    uncertainty: 0.12,
  },
  bolt: {
    name: 'Bolt',
    basePerKm: 4.5,
    baseFare: 12,
    perMinute: 0.55,
    minimumFare: 20,
    trafficSensitivity: 0.35,
    uncertainty: 0.12,
  },
  'yalla-bina': {
    name: 'Yalla Bina',
    basePerKm: 4.5,
    baseFare: 12,
    perMinute: 0.55,
    minimumFare: 20,
    trafficSensitivity: 0.35,
    uncertainty: 0.12,
  },
  'captain-egypt': {
    name: 'كابتن مصر',
    basePerKm: 4.5,
    baseFare: 12,
    perMinute: 0.55,
    minimumFare: 20,
    trafficSensitivity: 0.35,
    uncertainty: 0.12,
  },
  'smart-line': {
    name: 'Smart Line',
    basePerKm: 4.5,
    baseFare: 12,
    perMinute: 0.55,
    minimumFare: 20,
    trafficSensitivity: 0.35,
    uncertainty: 0.12,
  },
};

const COMFORT_CONFIG: ProviderConfig = {
  name: 'Comfort',
  basePerKm: 6,
  baseFare: 15,
  perMinute: 0.70,
  minimumFare: 25,
  trafficSensitivity: 0.35,
  uncertainty: 0.12,
};

function roundTo5(value: number): number {
  return Math.max(0, Math.round(value / 5) * 5);
}

export function calculateTrafficFactor(distanceKm: number, durationMinutes: number): number {
  if (distanceKm <= 0 || durationMinutes <= 0) return 1;
  const minutesPerKm = durationMinutes / distanceKm;
  if (minutesPerKm <= 3) return 0.95;
  if (minutesPerKm <= 5) return 1.00;
  if (minutesPerKm <= 7) return 1.08;
  if (minutesPerKm <= 10) return 1.16;
  if (minutesPerKm <= 15) return 1.25;
  return 1.32;
}

export function calculateTimeFactor(date?: Date): number {
  if (!date) return 1;
  const hour = date.getHours();
  if (hour >= 7 && hour < 10) return 1.08;
  if (hour >= 12 && hour < 15) return 1.03;
  if (hour >= 16 && hour < 20) return 1.10;
  if (hour >= 22 || hour < 6) return 0.97;
  return 1;
}

function categoryMultiplier(category: RideCategory, config?: ProviderConfig): number {
  if (category === 'comfort') return config?.comfortMultiplier ?? 1;
  if (category === 'scooter') return config?.scooterMultiplier ?? 0.72;
  return 1;
}

function getProviderConfig(providerId: RideProvider, category: RideCategory): ProviderConfig {
  if (category === 'comfort' && (providerId === 'uber' || providerId === 'careem')) {
    return COMFORT_CONFIG;
  }
  return RIDE_CONFIG[providerId];
}

function calculateInDriveFare(
  distanceKm: number,
  durationMinutes: number,
  indrive6KmPrice: number,
  trafficFactor: number,
  timeFactor: number,
  category: RideCategory,
): number {
  if (indrive6KmPrice <= 0) throw new Error('indrive6KmPrice يجب أن يكون أكبر من صفر');

  const basePerKm = indrive6KmPrice / 6;
  let fare = distanceKm * basePerKm;

  // inDrive لا يتأثر بالزحام بنفس قوة الخدمات ذات التعريفة الآلية.
  fare *= 1 + ((trafficFactor - 1) * 0.50);
  fare *= timeFactor;

  if (category === 'comfort') fare *= 1.22;
  if (category === 'scooter') fare *= 0.72;

  if (distanceKm < 3) {
    const minimum = indrive6KmPrice * 0.50 * (category === 'comfort' ? 1.22 : category === 'scooter' ? 0.72 : 1);
    fare = Math.max(fare, minimum);
  }

  return fare;
}

function calculateProviderFare(
  provider: ProviderConfig,
  distanceKm: number,
  durationMinutes: number,
  trafficFactor: number,
  timeFactor: number,
  category: RideCategory,
): number {
  let fare = provider.baseFare + distanceKm * provider.basePerKm + durationMinutes * provider.perMinute;

  fare *= 1 + ((trafficFactor - 1) * provider.trafficSensitivity);
  fare *= timeFactor;

  if (category === 'scooter') {
    fare *= provider.scooterMultiplier ?? 0.72;
  }

  fare = Math.max(fare, provider.minimumFare * (category === 'scooter' ? (provider.scooterMultiplier ?? 0.72) : 1));
  return fare;
}

export function estimateProviderPrice(
  providerId: RideProvider,
  input: RideInput,
): RideEstimate {
  if (input.distanceKm <= 0) throw new Error('distanceKm يجب أن يكون أكبر من صفر');
  if (input.durationMinutes <= 0) throw new Error('durationMinutes يجب أن يكون أكبر من صفر');

  const distanceKm = Number(input.distanceKm);
  const durationMinutes = Number(input.durationMinutes);
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) throw new Error('distanceKm يجب أن يكون رقمًا أكبر من صفر');
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) throw new Error('durationMinutes يجب أن يكون رقمًا أكبر من صفر');

  const category = input.category || 'economy';
  const provider = getProviderConfig(providerId, category);
  if (!provider) throw new Error(`مزود غير مدعوم: ${providerId}`);

  const trafficFactor = calculateTrafficFactor(distanceKm, durationMinutes);
  const timeFactor = calculateTimeFactor(input.startTime);

  const rawFare = providerId === 'indrive'
    ? calculateInDriveFare(distanceKm, durationMinutes, INDRIVE_6KM_PRICE, trafficFactor, timeFactor, category)
    : calculateProviderFare(provider, distanceKm, durationMinutes, trafficFactor, timeFactor, category);

  const estimatedFare = roundTo5(rawFare);
  const uncertainty = provider.uncertainty;
  const minFare = roundTo5(estimatedFare * (1 - uncertainty));
  const maxFare = Math.max(estimatedFare, roundTo5(estimatedFare * (1 + uncertainty)));

  return {
    provider: providerId,
    name: provider.name,
    estimatedFare,
    minFare,
    maxFare,
    effectivePerKm: Number((estimatedFare / distanceKm).toFixed(2)),
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMinutes: Math.round(durationMinutes),
    trafficFactor: Number(trafficFactor.toFixed(2)),
    timeFactor: Number(timeFactor.toFixed(2)),
    category,
  };
}

export function estimateRidePrices(input: RideInput): RideEstimate[] {
  return (Object.keys(RIDE_CONFIG) as RideProvider[])
    .map((provider) => estimateProviderPrice(provider, input))
    .sort((a, b) => a.estimatedFare - b.estimatedFare);
}
