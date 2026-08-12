import { Injectable } from '@nestjs/common';

import { CommentAction } from '@/simulation/actions/comment.action';
import { PostAction } from '@/simulation/actions/post.action';
import { SimulationCommand } from '@/simulation/actions/simulation-command';
import { SimulationActionOutcome } from '@/simulation/actions/simulation-decision';
import { VoteAction } from '@/simulation/actions/vote.action';

/** Dispatches a serializable command to the matching action strategy — the
 * Command pattern's invoker. It triggers commands but never performs them:
 * the action strategies and their injected providers (the receivers) do the
 * work. The command is the only thing the scheduler and admin API need to
 * know. */
@Injectable()
export class SimulationActionExecutor {
  constructor(
    private readonly postAction: PostAction,
    private readonly voteAction: VoteAction,
    private readonly commentAction: CommentAction,
  ) {}

  execute(command: SimulationCommand): Promise<SimulationActionOutcome> {
    switch (command.action) {
      case 'POST':
        return this.postAction.execute(command);
      case 'VOTE':
        return this.voteAction.execute(command);
      case 'COMMENT':
        return this.commentAction.execute(command);
    }
  }
}
