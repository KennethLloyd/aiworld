export type PostSimulationCommand = {
  action: 'POST';
  worldSlug: string;
  characterId: string;
};

export type VoteSimulationCommand = {
  action: 'VOTE';
  worldSlug: string;
  characterId: string;
  postId: string;
};

export type CommentSimulationCommand = {
  action: 'COMMENT';
  worldSlug: string;
  characterId: string;
  postId: string;
  parentCommentId?: string;
};

export type SimulationCommand =
  | PostSimulationCommand
  | VoteSimulationCommand
  | CommentSimulationCommand;
