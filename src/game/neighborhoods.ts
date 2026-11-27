export interface NeighborhoodDefinition {
  id: string;
  name: string;
  theme: string;
  challenge: string;
  unlockLabel: string;
  icon: string;
}

export const CITY_NEIGHBORHOODS: NeighborhoodDefinition[] = [
  { id: 'centro-industrial', name: 'Centro Industrial', theme: 'Energia e resíduos', challenge: 'Organizar a coleta, modernizar os prédios com energia solar e eletrificar a frota municipal.', unlockLabel: 'Primeira região · disponível desde o início', icon: '🏭' },
  { id: 'porto', name: 'Porto', theme: 'Água e logística', challenge: 'Controlar efluentes, instalar tratamento sanitário e coletar resíduos das empresas.', unlockLabel: 'Conclua o Centro Industrial', icon: '⚓' },
  { id: 'periferia-verde', name: 'Periferia Verde', theme: 'Saneamento e serviços', challenge: 'Ampliar a coleta seletiva, o saneamento básico e os serviços urbanos.', unlockLabel: 'Recupere o Porto', icon: '🏘️' },
  { id: 'reserva-florestal', name: 'Reserva Florestal', theme: 'Biodiversidade', challenge: 'Restaurar habitats, proteger nascentes e conectar corredores ecológicos.', unlockLabel: 'Recupere a Periferia Verde', icon: '🌳' },
  { id: 'zona-costeira', name: 'Zona Costeira', theme: 'Rios, manguezais e vida marinha', challenge: 'Seguir a bacia até o oceano, separar resíduos, restaurar manguezais e monitorar a vida costeira.', unlockLabel: 'Recupere a Reserva Florestal', icon: '🌊' },
  { id: 'cinturao-agricola', name: 'Cinturão Agrícola', theme: 'Solo e produção', challenge: 'Promover manejo do solo, uso eficiente da água e produção de baixo impacto.', unlockLabel: 'Recupere a Zona Costeira', icon: '🌱' },
  { id: 'centro-historico', name: 'Centro Histórico', theme: 'Mobilidade e patrimônio', challenge: 'Reduzir emissões, melhorar caminhabilidade e preservar espaços públicos.', unlockLabel: 'Recupere o Cinturão Agrícola', icon: '🏛️' },
  { id: 'distrito-tecnologico', name: 'Distrito Tecnológico', theme: 'Economia circular', challenge: 'Incentivar reuso de materiais, energia limpa e inovação industrial.', unlockLabel: 'Recupere o Centro Histórico', icon: '🔬' },
  { id: 'vale-das-nascentes', name: 'Vale das Nascentes', theme: 'Água doce e clima', challenge: 'Proteger nascentes, recuperar matas ciliares e controlar a erosão.', unlockLabel: 'Recupere o Distrito Tecnológico', icon: '💧' },
  { id: 'ilha-biodiversidade', name: 'Ilha da Biodiversidade', theme: 'Ecossistemas integrados', challenge: 'Consolidar a recuperação ecológica e equilibrar turismo, comunidades e conservação.', unlockLabel: 'Recupere o Vale das Nascentes', icon: '🦜' },
];
