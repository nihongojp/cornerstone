// src/data/characters.ts
export type Ability = { name: string; effect: string };
export type Character = {
  id: string;
  name: string;
  met: string; // ISO date or any string
  description: string;
  abilities: Ability[];
  image?: string; // url
};

export const CHARACTERS: Character[] = [
  {
    id: 'momotaro',
    name: 'Momotaro',
    met: '2020-08-29',
    description:
      'A young boy born from a peach, he defeats the oni on Onigashima with his friends: the dog, pheasant, and monkey.',
    abilities: [{ name: 'Kibidango', effect: '+2 damage per correct answer' }],
    image: '', // put an image URL if you have one
  },
  {
    id: 'kintaro',
    name: 'Kintaro',
    met: '2021-03-14',
    description:
      'A child of superhuman strength who befriends animals and later becomes a retainer of Minamoto no Yorimitsu.',
    abilities: [{ name: 'Bear Hug', effect: 'Stuns an enemy for 1 turn' }],
  },
  {
    id: 'urashima',
    name: 'Urashima Tarō',
    met: '2022-05-10',
    description:
      'Fisherman who saves a turtle, visits the Dragon Palace, and returns with a mysterious box.',
    abilities: [{ name: 'Tamatebako', effect: 'Mystic time effect on reveal' }],
  },
  {
    id: 'issun-boshi',
    name: 'Issun-bōshi',
    met: '2023-01-22',
    description:
      'One-inch samurai who proves bravery far beyond his size.',
    abilities: [{ name: 'Needle Sword', effect: 'High crit chance' }],
  },
];

export const getCharacterById = (id: string) =>
  CHARACTERS.find((c) => c.id === id);
