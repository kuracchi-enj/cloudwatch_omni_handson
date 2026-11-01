// Only fixed sample fields are recorded. Never log the input event or credentials.
export async function handler(event, context) {
  const requested = event?.scenario;
  const scenario = ['success', 'warning', 'error'].includes(requested) ? requested : 'success';
  const common = {
    service: 'omni-handson-orders',
    environment: 'handson',
    requestId: context.awsRequestId,
    scenario,
  };

  console.info({ ...common, event: 'order_started', message: 'Sample order processing started' });

  if (scenario === 'warning') {
    console.warn({ ...common, event: 'inventory_low', message: 'Sample inventory is low', remainingItems: 2 });
  }

  if (scenario === 'error') {
    console.error({
      ...common,
      event: 'order_failed',
      message: 'Simulated payment failure',
      errorCode: 'PAYMENT_SIMULATED_FAILURE',
    });
    throw new Error('Simulated payment failure');
  }

  console.info({ ...common, event: 'order_completed', message: 'Sample order completed' });
  return { statusCode: 200, scenario, requestId: context.awsRequestId };
}
