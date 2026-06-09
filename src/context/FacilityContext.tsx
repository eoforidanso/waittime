import { createContext, useContext, useState, type ReactNode } from 'react';

// ─── Facility List ────────────────────────────────────────────────────────────
export interface Facility {
  id: string;
  name: string;
  town: string;
}

export const FACILITIES: Facility[] = [
  { id: 'hofaho-techiman',   name: 'HOFAHO',                            town: 'Techiman'       },
  { id: 'korle-bu',          name: 'Korle Bu Teaching Hospital',        town: 'Accra'          },
  { id: 'komfo-anokye',      name: 'Komfo Anokye Teaching Hospital',    town: 'Kumasi'         },
  { id: 'tamale-teaching',   name: 'Tamale Teaching Hospital',          town: 'Tamale'         },
  { id: 'cape-coast',        name: 'Cape Coast Teaching Hospital',      town: 'Cape Coast'     },
  { id: '37-military',       name: '37 Military Hospital',              town: 'Accra'          },
  { id: 'st-dominic',        name: "St. Dominic's Hospital",            town: 'Akwatia'        },
  { id: 'ridge',             name: 'Ridge Regional Hospital',           town: 'Accra'          },
  { id: 'sunyani',           name: 'Sunyani Regional Hospital',         town: 'Sunyani'        },
  { id: 'bolgatanga',        name: 'Bolgatanga Regional Hospital',      town: 'Bolgatanga'     },
  { id: 'other',             name: 'Other / Custom',                    town: ''               },
];

const STORAGE_KEY = 'mediq_facility';

// ─── Context ──────────────────────────────────────────────────────────────────
interface FacilityContextType {
  facility: Facility | null;
  setFacility: (f: Facility) => void;
  displayName: string;
}

const FacilityContext = createContext<FacilityContextType | null>(null);

export function useFacility() {
  const ctx = useContext(FacilityContext);
  if (!ctx) throw new Error('useFacility must be used inside FacilityProvider');
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function FacilityProvider({ children }: { children: ReactNode }) {
  const [facility, setFacilityState] = useState<Facility | null>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Facility;
        // Validate the saved value still exists in the list
        const match = FACILITIES.find(f => f.id === parsed.id);
        return match ?? parsed; // keep custom if it was 'other'
      }
    } catch { /* ignore */ }
    return null;
  });

  const setFacility = (f: Facility) => {
    setFacilityState(f);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(f)); } catch { /* ignore */ }
  };

  const displayName = facility
    ? facility.town ? `${facility.name} – ${facility.town}` : facility.name
    : '';

  return (
    <FacilityContext.Provider value={{ facility, setFacility, displayName }}>
      {children}
    </FacilityContext.Provider>
  );
}
