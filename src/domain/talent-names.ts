import type { TalentRole } from './types';

interface TalentNameBucket {
  id: string;
  weight: number;
  masculineGivenNames: readonly string[];
  feminineGivenNames: readonly string[];
  neutralGivenNames: readonly string[];
  familyNames: readonly string[];
}

interface ReserveTalentNameInput {
  worldSeed: number;
  role: TalentRole;
  sequenceIndex: number;
  usedNames: Set<string>;
}

const TALENT_NAME_BUCKETS: readonly TalentNameBucket[] = [
  {
    id: 'usMainstream',
    weight: 36,
    masculineGivenNames: [
      'Ethan', 'Lucas', 'Mason', 'Carter', 'Logan', 'Owen', 'Noah', 'Caleb', 'Ryan',
      'Dylan', 'Cole', 'Miles', 'Connor', 'Graham', 'Julian', 'Austin', 'Tyler', 'Bennett',
    ],
    feminineGivenNames: [
      'Emma', 'Olivia', 'Charlotte', 'Amelia', 'Harper', 'Evelyn', 'Nora', 'Chloe', 'Lily',
      'Grace', 'Zoe', 'Audrey', 'Hannah', 'Lucy', 'Ella', 'Claire', 'Natalie', 'Julia',
    ],
    neutralGivenNames: [
      'Avery', 'Cameron', 'Jordan', 'Riley', 'Taylor', 'Parker', 'Morgan', 'Quinn', 'Casey', 'Rowan',
    ],
    familyNames: [
      'Parker', 'Bennett', 'Hayes', 'Brooks', 'Sullivan', 'Foster', 'Reynolds', 'Griffin',
      'Walsh', 'Harper', 'Lawson', 'Beck', 'Dawson', 'Sutton', 'Keller', 'Monroe', 'Collins',
      'Bailey', 'Hudson', 'Price', 'Walker', 'Porter', 'Ellis', 'Mercer',
    ],
  },
  {
    id: 'usBlack',
    weight: 17,
    masculineGivenNames: [
      'Malcolm', 'Darius', 'Andre', 'Jamal', 'Marcus', 'Xavier', 'Desmond', 'Terrence',
      'Isaiah', 'Kendrick', 'Devon', 'Jalen', 'Byron', 'Tristan',
    ],
    feminineGivenNames: [
      'Aaliyah', 'Nia', 'Imani', 'Simone', 'Tiana', 'Jasmine', 'Kiara', 'Monique',
      'Zaria', 'Danielle', 'Maya', 'Raven', 'Arielle', 'Kennedy',
    ],
    neutralGivenNames: [
      'Jordan', 'Skylar', 'Kameron', 'Milan', 'Sydney', 'Justice', 'Taylor', 'Micah',
    ],
    familyNames: [
      'Jackson', 'Brooks', 'Richardson', 'Freeman', 'Coleman', 'Whitaker', 'Tucker', 'McDaniels',
      'Lawson', 'Boone', 'Fields', 'Bentley', 'Holmes', 'Hines', 'Glover', 'Byrd',
      'Merriweather', 'Carter',
    ],
  },
  {
    id: 'latino',
    weight: 15,
    masculineGivenNames: [
      'Mateo', 'Diego', 'Javier', 'Rafael', 'Santiago', 'Adrian', 'Nicolas', 'Luis',
      'Marco', 'Andres', 'Gabriel', 'Tomas', 'Emilio', 'Joaquin',
    ],
    feminineGivenNames: [
      'Sofia', 'Camila', 'Valeria', 'Lucia', 'Elena', 'Mariana', 'Daniela', 'Adriana',
      'Natalia', 'Paloma', 'Carla', 'Isabela', 'Renata', 'Alejandra',
    ],
    neutralGivenNames: [
      'Alex', 'Noel', 'Ariel', 'Cruz', 'Gael', 'Angel', 'Jaime', 'Dani',
    ],
    familyNames: [
      'Ramirez', 'Morales', 'Castillo', 'Vega', 'Navarro', 'Ortega', 'Herrera', 'Medina',
      'Salazar', 'Rios', 'Campos', 'Duarte', 'Mendez', 'Lozano', 'Cabrera', 'Pineda',
      'Fuentes', 'Villanueva', 'Serrano', 'Delgado',
    ],
  },
  {
    id: 'westernEuropean',
    weight: 10,
    masculineGivenNames: [
      'Theo', 'Luca', 'Hugo', 'Felix', 'Leon', 'Nico', 'Elias', 'Marcel',
      'Oscar', 'Henri', 'Anton', 'Matteo',
    ],
    feminineGivenNames: [
      'Clara', 'Elise', 'Margot', 'Ingrid', 'Helena', 'Amelie', 'Lina', 'Freya',
      'Sophie', 'Nina', 'Louisa', 'Eva',
    ],
    neutralGivenNames: [
      'Remy', 'Jules', 'Noa', 'Sacha', 'Robin', 'Mika',
    ],
    familyNames: [
      'Laurent', 'Fischer', 'Moreau', 'Weber', 'Dubois', 'Berger', 'Klein', 'Bauer',
      'Meier', 'Romano', 'Silvestri', 'Fontana', 'Ricci', 'Olivier', 'Schmid', 'Keller',
      'Martens', 'Falk',
    ],
  },
  {
    id: 'eastAsian',
    weight: 8,
    masculineGivenNames: [
      'Minho', 'Joon', 'Haruto', 'Ren', 'Kaito', 'Daichi', 'Kenji', 'Yuto',
      'Taiki', 'Wei', 'Jian', 'Hao', 'Jun', 'Takeshi',
    ],
    feminineGivenNames: [
      'Mei', 'Yuna', 'Hana', 'Aiko', 'Rina', 'Nari', 'Jiwoo', 'Mina',
      'Haruka', 'Lin', 'Xinyi', 'Reina', 'Kaori', 'Yuri',
    ],
    neutralGivenNames: [
      'Kai', 'Rin', 'Yuki', 'Ren', 'Akira', 'Min',
    ],
    familyNames: [
      'Kim', 'Park', 'Choi', 'Lee', 'Lin', 'Chen', 'Wang', 'Tanaka',
      'Sato', 'Nakamura', 'Watanabe', 'Ito', 'Zhang', 'Liu', 'Xu', 'Huang',
      'Yang', 'Lim',
    ],
  },
  {
    id: 'southAsian',
    weight: 6,
    masculineGivenNames: [
      'Arjun', 'Rohan', 'Vikram', 'Kiran', 'Dev', 'Neel', 'Aarav', 'Kabir',
      'Jay', 'Sameer', 'Aditya', 'Rahul', 'Imran', 'Farhan',
    ],
    feminineGivenNames: [
      'Anika', 'Priya', 'Mira', 'Leena', 'Kavya', 'Riya', 'Sonia', 'Asha',
      'Nisha', 'Diya', 'Sana', 'Meera', 'Tara', 'Nadia',
    ],
    neutralGivenNames: [
      'Kiran', 'Aadi', 'Noor', 'Arya', 'Aman', 'Ishan',
    ],
    familyNames: [
      'Patel', 'Shah', 'Mehta', 'Kapoor', 'Malhotra', 'Rao', 'Iyer', 'Singh',
      'Batra', 'Sethi', 'Anand', 'Nair', 'Khanna', 'Bhandari', 'Desai', 'Bhatt',
      'Kulkarni', 'Joshi',
    ],
  },
  {
    id: 'middleEastern',
    weight: 4,
    masculineGivenNames: [
      'Omar', 'Amir', 'Samir', 'Karim', 'Zayn', 'Faris', 'Tarek', 'Bilal', 'Nabil', 'Adel',
    ],
    feminineGivenNames: [
      'Layla', 'Nadia', 'Yasmin', 'Amira', 'Leila', 'Samira', 'Noor', 'Dalia', 'Hana', 'Mariam',
    ],
    neutralGivenNames: [
      'Noor', 'Rami', 'Sami', 'Dana', 'Rayan',
    ],
    familyNames: [
      'Haddad', 'Mansour', 'Farouk', 'Nasser', 'Khalil', 'Rahman', 'Aziz', 'Darwish',
      'Hamdan', 'Saleh', 'Jaber', 'Najjar', 'Abboud', 'Safi', 'Zaki',
    ],
  },
  {
    id: 'african',
    weight: 4,
    masculineGivenNames: [
      'Kwame', 'Tunde', 'Ade', 'Jelani', 'Kofi', 'Sefu', 'Amadou', 'Chike', 'Kojo', 'Tariq',
    ],
    feminineGivenNames: [
      'Amara', 'Zuri', 'Adanna', 'Ayana', 'Nala', 'Efe', 'Sade', 'Ife', 'Mirembe', 'Amina',
    ],
    neutralGivenNames: [
      'Amani', 'Tayo', 'Kesi', 'Sade', 'Nuru',
    ],
    familyNames: [
      'Okafor', 'Mensah', 'Diallo', 'Nwosu', 'Abebe', 'Tesfaye', 'Adeniyi', 'Balogun',
      'Adebayo', 'Njoroge', 'Mbeki', 'Kamau', 'Fofana', 'Sow', 'Traore',
    ],
  },
] as const;

const ROLE_SALTS: Record<string, number> = {
  director: 101,
  leadActor: 211,
  leadActress: 307,
  supportingActor: 409,
  cinematographer: 503,
  composer: 601,
};

const roleNamePoolCache = new Map<string, string[]>();

function normalizeTalentSeed(worldSeed: number): number {
  return Number.isFinite(worldSeed) ? Math.max(0, Math.floor(Math.abs(worldSeed))) : 0;
}

function createSeededRng(seed: number): () => number {
  let state = (seed >>> 0) || 1;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

function shuffleSeeded<T>(values: readonly T[], seed: number): T[] {
  const copy = [...values];
  const rng = createSeededRng(seed);
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }
  return copy;
}

function uniqueNames(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function bucketIdSalt(bucketId: string): number {
  return [...bucketId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function getGivenNamesForRole(bucket: TalentNameBucket, role: TalentRole): string[] {
  if (role === 'leadActor' || role === 'supportingActor') {
    return [...bucket.masculineGivenNames];
  }
  if (role === 'leadActress') {
    return [...bucket.feminineGivenNames];
  }
  if (role === 'director') {
    return uniqueNames([
      ...bucket.neutralGivenNames,
      ...bucket.masculineGivenNames,
      ...bucket.feminineGivenNames,
    ]);
  }

  return uniqueNames([
    ...bucket.neutralGivenNames,
    ...bucket.masculineGivenNames,
    ...bucket.feminineGivenNames,
  ]);
}

function buildBucketRoleNamePool(bucket: TalentNameBucket, role: TalentRole, worldSeed: number): string[] {
  const givenNames = getGivenNamesForRole(bucket, role);
  const familyNames = uniqueNames(bucket.familyNames);
  const fullNames: string[] = [];

  for (const givenName of givenNames) {
    for (const familyName of familyNames) {
      fullNames.push(`${givenName} ${familyName}`);
    }
  }

  const roleSalt = ROLE_SALTS[role] ?? 701;
  return shuffleSeeded(fullNames, worldSeed + roleSalt + bucketIdSalt(bucket.id) * 17);
}

function buildWeightedRoleNamePool(worldSeed: number, role: TalentRole): string[] {
  const normalizedSeed = normalizeTalentSeed(worldSeed);
  const cacheKey = `${normalizedSeed}:${role}`;
  const cached = roleNamePoolCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const buckets = TALENT_NAME_BUCKETS.map((bucket) => ({
    weight: bucket.weight,
    cursor: 0,
    names: buildBucketRoleNamePool(bucket, role, normalizedSeed),
  }));
  const roleSalt = ROLE_SALTS[role] ?? 701;
  const rng = createSeededRng(normalizedSeed + roleSalt * 13 + 29);
  const pool: string[] = [];

  while (true) {
    const availableBuckets = buckets.filter((bucket) => bucket.cursor < bucket.names.length);
    if (availableBuckets.length === 0) {
      break;
    }

    const totalWeight = availableBuckets.reduce((sum, bucket) => sum + bucket.weight, 0);
    let target = rng() * totalWeight;
    let chosenBucket = availableBuckets[availableBuckets.length - 1];

    for (const bucket of availableBuckets) {
      target -= bucket.weight;
      if (target <= 0) {
        chosenBucket = bucket;
        break;
      }
    }

    pool.push(chosenBucket.names[chosenBucket.cursor]);
    chosenBucket.cursor += 1;
  }

  roleNamePoolCache.set(cacheKey, pool);
  return pool;
}

function buildFallbackTalentName(sequenceIndex: number, usedNames: Set<string>): string {
  let suffix = Math.max(1, Math.floor(Math.abs(sequenceIndex)) + 1);
  let candidate = `Talent ${suffix}`;
  while (usedNames.has(candidate)) {
    suffix += 1;
    candidate = `Talent ${suffix}`;
  }
  return candidate;
}

export function reserveSeededTalentName({
  worldSeed,
  role,
  sequenceIndex,
  usedNames,
}: ReserveTalentNameInput): string {
  const pool = buildWeightedRoleNamePool(worldSeed, role);
  const normalizedIndex = Math.max(0, Math.floor(Math.abs(sequenceIndex)));

  if (pool.length > 0) {
    const startIndex = normalizedIndex % pool.length;
    for (let offset = 0; offset < pool.length; offset += 1) {
      const candidate = pool[(startIndex + offset) % pool.length];
      if (!usedNames.has(candidate)) {
        usedNames.add(candidate);
        return candidate;
      }
    }
  }

  const fallback = buildFallbackTalentName(normalizedIndex, usedNames);
  usedNames.add(fallback);
  return fallback;
}
