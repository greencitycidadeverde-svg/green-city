export interface NeighborhoodDefinition {
  id: string;
  name: string;
  theme: string;
  challenge: string;
  unlockLabel: string;
}

export const CITY_NEIGHBORHOODS: NeighborhoodDefinition[] = [
  {
    id: 'centro-industrial',
    name: 'Centro Industrial',
    theme: 'Resíduos, energia e mobilidade',
    challenge: 'Organizar a coleta, implantar energia solar e eletrificar o veículo municipal.',
    unlockLabel: 'Primeira região · disponível desde o início',
  },
  {
    id: 'porto',
    name: 'Porto',
    theme: 'Logística e água',
    challenge: 'Reduzir a poluição da água e tornar o transporte de cargas mais eficiente.',
    unlockLabel: 'Conclua a recuperação do Centro Industrial',
  },
  {
    id: 'periferia-verde',
    name: 'Periferia Verde',
    theme: 'Serviços urbanos e transporte público',
    challenge: 'Ampliar a coleta seletiva, o saneamento e as opções de mobilidade coletiva.',
    unlockLabel: 'Recupere o Porto para avançar',
  },
  {
    id: 'reserva-florestal',
    name: 'Reserva Florestal',
    theme: 'Biodiversidade e restauração',
    challenge: 'Recuperar habitats, proteger nascentes e conectar áreas verdes.',
    unlockLabel: 'Recupere a Periferia Verde para avançar',
  },
  {
    id: 'zona-costeira',
    name: 'Zona Costeira',
    theme: 'Saneamento e resiliência climática',
    challenge: 'Proteger a costa, tratar efluentes e preparar a cidade para eventos extremos.',
    unlockLabel: 'Recupere a Reserva Florestal para avançar',
  },
];
