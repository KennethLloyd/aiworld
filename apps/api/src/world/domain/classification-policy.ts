export type ClassificationPolicy = (
  classification: string | null | undefined,
  classificationGroup: string | null | undefined,
) => void;

const MBTI_GROUPS: Record<string, string> = {
  ISTJ: 'SJ',
  ISFJ: 'SJ',
  ESTJ: 'SJ',
  ESFJ: 'SJ',
  ISTP: 'SP',
  ISFP: 'SP',
  ESTP: 'SP',
  ESFP: 'SP',
  INFJ: 'NF',
  INFP: 'NF',
  ENFJ: 'NF',
  ENFP: 'NF',
  INTJ: 'NT',
  INTP: 'NT',
  ENTJ: 'NT',
  ENTP: 'NT',
};

function validateMbtiHouseClassification(
  classification: string | null | undefined,
  classificationGroup: string | null | undefined,
): void {
  if (!classification || !classificationGroup) {
    throw new Error(
      'The mbti-house World requires classification and classificationGroup',
    );
  }

  const expectedGroup = MBTI_GROUPS[classification.toUpperCase()];
  if (!expectedGroup || expectedGroup !== classificationGroup.toUpperCase()) {
    throw new Error(
      'classification and classificationGroup are not a valid MBTI pair',
    );
  }
}

const worldClassificationPolicies: Record<string, ClassificationPolicy> = {
  'mbti-house': validateMbtiHouseClassification,
};

export function validateWorldClassificationPolicy(
  worldSlug: string,
  classification: string | null | undefined,
  classificationGroup: string | null | undefined,
): void {
  worldClassificationPolicies[worldSlug]?.(classification, classificationGroup);
}
