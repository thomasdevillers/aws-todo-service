import type { SQSEvent, SQSBatchResponse } from 'aws-lambda';

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const failures: { itemIdentifier: string }[] = [];

  for (const record of event.Records) {
    try {
      // SQS-from-SNS wraps the SNS payload in a Message field
      const snsEnvelope = JSON.parse(record.body);
      const payload = JSON.parse(snsEnvelope.Message);

      console.log('processing event', { type: payload.type, id: payload.todo?.id });

      // In a real app: send an email, update Elasticsearch, write to a data lake, etc.
      // For now we just log it.
    } catch (err) {
      console.error('failed to process record', record.messageId, err);
      failures.push({ itemIdentifier: record.messageId });
    }
  }

  // Partial batch response: only failed records will be retried.
  return { batchItemFailures: failures };
};