import { App, Tags } from 'aws-cdk-lib';
import { CloudWatchOmniHandsonStack } from '../lib/cloudwatch-omni-handson-stack.ts';

const app = new App();
new CloudWatchOmniHandsonStack(app, 'CloudWatchOmniHandsonStack', {
  description: 'Minimal Lambda log source for CloudWatch Omni; Omni setup is a separate prerequisite',
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? process.env.CDK_DEFAULT_REGION ?? 'ap-northeast-1',
  },
});
Tags.of(app).add('Project', 'cloudwatch-omni-handson');
Tags.of(app).add('Environment', 'handson');
