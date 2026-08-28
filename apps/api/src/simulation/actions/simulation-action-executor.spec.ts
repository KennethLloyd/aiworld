import { LlmProvider } from '@/simulation/providers/llm-provider.port';

import { SimulationActionExecutor } from './simulation-action-executor';

describe('SimulationActionExecutor', () => {
  function createExecutor() {
    const postAction = {
      execute: jest.fn().mockResolvedValue({ status: 'success' }),
    };
    const voteAction = {
      execute: jest.fn().mockResolvedValue({ status: 'success' }),
    };
    const commentAction = {
      execute: jest.fn().mockResolvedValue({ status: 'success' }),
    };

    const executor = new SimulationActionExecutor(
      postAction as never,
      voteAction as never,
      commentAction as never,
    );

    return { executor, postAction, voteAction, commentAction };
  }

  it('dispatches a POST command to the post action', async () => {
    const { executor, postAction, voteAction, commentAction } =
      createExecutor();
    const command = {
      action: 'POST' as const,
      worldSlug: 'mbti-house',
      characterId: 'character-1',
    };

    const result = await executor.execute(command);

    expect(postAction.execute).toHaveBeenCalledWith(command);
    expect(voteAction.execute).not.toHaveBeenCalled();
    expect(commentAction.execute).not.toHaveBeenCalled();
    expect(result).toEqual({ status: 'success' });
  });

  it('dispatches a VOTE command to the vote action', async () => {
    const { executor, postAction, voteAction } = createExecutor();
    const command = {
      action: 'VOTE' as const,
      worldSlug: 'mbti-house',
      characterId: 'character-1',
      postId: 'post-1',
    };

    await executor.execute(command);

    expect(voteAction.execute).toHaveBeenCalledWith(command);
    expect(postAction.execute).not.toHaveBeenCalled();
  });

  it('dispatches a COMMENT command to the comment action', async () => {
    const { executor, postAction, commentAction } = createExecutor();
    const command = {
      action: 'COMMENT' as const,
      worldSlug: 'mbti-house',
      characterId: 'character-1',
      postId: 'post-1',
    };

    await executor.execute(command);

    expect(commentAction.execute).toHaveBeenCalledWith(command);
    expect(postAction.execute).not.toHaveBeenCalled();
  });

  it('returns the outcome of the dispatched action', async () => {
    const { executor, voteAction } = createExecutor();
    voteAction.execute.mockResolvedValue({
      status: 'failed',
      failure: { code: 'TIMEOUT', message: 'Mock timeout', retryable: true },
    });

    const result = await executor.execute({
      action: 'VOTE' as const,
      worldSlug: 'mbti-house',
      characterId: 'character-1',
      postId: 'post-1',
    });

    expect(result).toEqual({
      status: 'failed',
      failure: { code: 'TIMEOUT', message: 'Mock timeout', retryable: true },
    });
  });

  it('passes a World-resolved provider to the selected action', async () => {
    const { executor, postAction } = createExecutor();
    const provider = { config: { providerId: 'mock', model: 'world-model' } };
    const command = {
      action: 'POST' as const,
      worldSlug: 'mbti-house',
      characterId: 'character-1',
    };

    await executor.execute(command, provider as unknown as LlmProvider);

    expect(postAction.execute).toHaveBeenCalledWith(command, provider);
  });
});
