import { Injectable } from '@nestjs/common';

import { CommentAction } from '@/simulation/actions/comment.action';
import { PostAction } from '@/simulation/actions/post.action';
import { SimulationCommand } from '@/simulation/actions/simulation-command';
import { SimulationActionOutcome } from '@/simulation/actions/simulation-decision';
import { VoteAction } from '@/simulation/actions/vote.action';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';

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

  execute(
    command: SimulationCommand,
    provider?: LlmProvider,
  ): Promise<SimulationActionOutcome> {
    switch (command.action) {
      case 'POST':
        return provider === undefined
          ? this.postAction.execute(command)
          : this.postAction.execute(command, provider);
      case 'VOTE':
        return provider === undefined
          ? this.voteAction.execute(command)
          : this.voteAction.execute(command, provider);
      case 'COMMENT':
        return provider === undefined
          ? this.commentAction.execute(command)
          : this.commentAction.execute(command, provider);
    }
  }
}
