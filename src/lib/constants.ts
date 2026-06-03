export const SERVICES = [
  { 
    code: 'DG' as const, 
    id: '00000000-0000-0000-0000-000000000000', 
    name: 'Direction Générale', 
    color: 'bg-navy-600 text-white',
    description: 'Service de direction et super-utilisateur (DG)'
  },
  { 
    code: 'DII' as const, 
    id: 'DII', 
    name: 'Direction de l\'Insertion et de l\'Immigration (DII)', 
    color: 'bg-blue-600 text-white',
    description: 'Insertion et immigration professionnelle'
  },
  { 
    code: 'DEJ' as const, 
    id: 'DEJ', 
    name: 'Direction de l\'Emploi des Jeunes (DEJ)', 
    color: 'bg-emerald-600 text-white',
    description: 'Programmes d\'emploi pour la jeunesse'
  },
  { 
    code: 'DDPAE' as const, 
    id: 'DDPAE', 
    name: 'Direction du Développement Professionnel (DDPAE)', 
    color: 'bg-purple-600 text-white',
    description: 'Développement des compétences et de l\'accompagnement'
  },
  { 
    code: 'DAMG' as const, 
    id: 'DAMG', 
    name: 'Direction de l\'Appui aux Métiers et à la Gestion (DAMG)', 
    color: 'bg-orange-600 text-white',
    description: 'Support technique et gestion opérationnelle'
  },
  { 
    code: 'SRH' as const, 
    id: 'SRH', 
    name: 'Service des Ressources Humaines (SRH)', 
    color: 'bg-teal-600 text-white',
    description: 'Gestion du personnel et des carrières'
  },
  { 
    code: 'SCP' as const, 
    id: 'SCP', 
    name: 'Service Communication et Partenariat (SCP)', 
    color: 'bg-pink-600 text-white',
    description: 'Relations publiques, communication et partenariats'
  },
  { 
    code: 'SSA' as const, 
    id: 'SSA', 
    name: 'Service Social et d\'Accompagnement (SSA)', 
    color: 'bg-amber-600 text-white',
    description: 'Soutien social des bénéficiaires et agents'
  }
] as const;

export type ServiceCode = typeof SERVICES[number]['code'];

// Utilitaires de conversion
export function getServiceByCode(code: string) {
  return SERVICES.find(s => s.code === code) || SERVICES[0];
}

export function getServiceById(id: string) {
  return SERVICES.find(s => s.id === id) || SERVICES[0];
}

// Convertit l'id de l'UI (ex: UUID de la DG) vers le code de service de la DB
export function uiIdToDbService(id: string): ServiceCode {
  if (id === '00000000-0000-0000-0000-000000000000') {
    return 'DG';
  }
  const match = SERVICES.find(s => s.id === id);
  return match ? match.code : 'DG';
}

// Convertit le code de service de la DB vers l'id de l'UI
export function dbServiceToUiId(code: ServiceCode): string {
  if (code === 'DG') {
    return '00000000-0000-0000-0000-000000000000';
  }
  const match = SERVICES.find(s => s.code === code);
  return match ? match.id : '00000000-0000-0000-0000-000000000000';
}
