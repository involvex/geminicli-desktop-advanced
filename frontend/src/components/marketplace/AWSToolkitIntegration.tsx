import React, { useState } from 'react';
import { Cloud, Database, Lambda, Settings, Terminal, FileText } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface AWSService {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  status: 'available' | 'configured' | 'error';
}

export const AWSToolkitIntegration: React.FC = () => {
  const [services, setServices] = useState<AWSService[]>([
    {
      id: 'lambda',
      name: 'AWS Lambda',
      icon: <Lambda className="w-5 h-5" />,
      description: 'Serverless function management',
      status: 'available'
    },
    {
      id: 's3',
      name: 'Amazon S3',
      icon: <Database className="w-5 h-5" />,
      description: 'Object storage service',
      status: 'available'
    },
    {
      id: 'cloudformation',
      name: 'CloudFormation',
      icon: <FileText className="w-5 h-5" />,
      description: 'Infrastructure as Code',
      status: 'available'
    }
  ]);

  const [credentials, setCredentials] = useState({
    accessKeyId: '',
    secretAccessKey: '',
    region: 'us-east-1'
  });

  const handleServiceConnect = (serviceId: string) => {
    setServices(prev => prev.map(service => 
      service.id === serviceId 
        ? { ...service, status: 'configured' }
        : service
    ));
  };

  const handleCredentialsSave = () => {
    // Save AWS credentials securely
    console.log('Saving AWS credentials...');
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Cloud className="w-6 h-6 text-orange-500" />
        <h1 className="text-2xl font-bold">AWS Toolkit Integration</h1>
      </div>

      <Tabs defaultValue="services" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="terminal">AWS CLI</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <Card key={service.id}>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    {service.icon}
                    <CardTitle className="text-lg">{service.name}</CardTitle>
                  </div>
                  <CardDescription>{service.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    className="w-full"
                    variant={service.status === 'configured' ? 'secondary' : 'default'}
                    onClick={() => handleServiceConnect(service.id)}
                  >
                    {service.status === 'configured' ? 'Connected' : 'Connect'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="credentials" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AWS Credentials</CardTitle>
              <CardDescription>Configure your AWS access credentials</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accessKeyId">Access Key ID</Label>
                <Input
                  id="accessKeyId"
                  type="password"
                  value={credentials.accessKeyId}
                  onChange={(e) => setCredentials(prev => ({ ...prev, accessKeyId: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secretAccessKey">Secret Access Key</Label>
                <Input
                  id="secretAccessKey"
                  type="password"
                  value={credentials.secretAccessKey}
                  onChange={(e) => setCredentials(prev => ({ ...prev, secretAccessKey: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="region">Default Region</Label>
                <Input
                  id="region"
                  value={credentials.region}
                  onChange={(e) => setCredentials(prev => ({ ...prev, region: e.target.value }))}
                />
              </div>
              <Button onClick={handleCredentialsSave} className="w-full">
                <Settings className="w-4 h-4 mr-2" />
                Save Credentials
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="terminal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AWS CLI Integration</CardTitle>
              <CardDescription>Execute AWS CLI commands directly</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Terminal className="w-4 h-4" />
                  <span>AWS CLI Terminal</span>
                </div>
                <div>$ aws s3 ls</div>
                <div>$ aws lambda list-functions</div>
                <div>$ aws cloudformation list-stacks</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};