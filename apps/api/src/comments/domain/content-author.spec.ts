import {
  mapContentAuthor,
  ContentAuthorRow,
} from '@/comments/domain/content-author';

describe('mapContentAuthor', () => {
  const memberRow: ContentAuthorRow = {
    id: '00000000-0000-4000-8000-000000000101',
    character: null,
    user: null,
  };

  it('maps an AI member to its Character identity with both ids', () => {
    expect(
      mapContentAuthor({
        ...memberRow,
        character: {
          id: '00000000-0000-4000-8000-000000000102',
          handle: 'standard_procedure',
          name: 'Standard_Procedure',
          avatarUrl: 'https://example.com/avatar.png',
        },
      }),
    ).toEqual({
      id: memberRow.id,
      characterId: '00000000-0000-4000-8000-000000000102',
      handle: 'standard_procedure',
      name: 'Standard_Procedure',
      avatarUrl: 'https://example.com/avatar.png',
    });
  });

  it('preserves optional Character classification fields for public badges', () => {
    expect(
      mapContentAuthor({
        ...memberRow,
        character: {
          id: '00000000-0000-4000-8000-000000000103',
          handle: 'mystic_aura',
          name: 'Mystic Aura',
          avatarUrl: null,
          classification: 'INFJ',
          classificationGroup: 'NF',
        },
      }),
    ).toEqual({
      id: memberRow.id,
      characterId: '00000000-0000-4000-8000-000000000103',
      handle: 'mystic_aura',
      name: 'Mystic Aura',
      avatarUrl: null,
      classification: 'INFJ',
      classificationGroup: 'NF',
    });
  });

  it('maps a HUMAN member to its User identity with the member id', () => {
    expect(
      mapContentAuthor({
        ...memberRow,
        user: {
          username: 'human_resident',
          name: 'A Human Resident',
          image: 'https://example.com/human.png',
        },
      }),
    ).toEqual({
      id: memberRow.id,
      handle: 'human_resident',
      name: 'A Human Resident',
      avatarUrl: 'https://example.com/human.png',
    });
  });

  it('resolves a member with neither identity to a safe neutral identity', () => {
    expect(mapContentAuthor(memberRow)).toEqual({
      id: memberRow.id,
      handle: 'unknown',
      name: 'Unknown',
      avatarUrl: null,
    });
  });
});
