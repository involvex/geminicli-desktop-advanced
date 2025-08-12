import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Brain, TrendingUp, FileText, MessageSquare } from "lucide-react";

interface LearningInsight {
  id: string;
  type: "pattern" | "improvement" | "suggestion";
  title: string;
  description: string;
  confidence: number;
  frequency: number;
}

interface ProjectLearningProps {
  projectPath: string;
}

export function ProjectLearning({ projectPath }: ProjectLearningProps) {
  const [insights, setInsights] = useState<LearningInsight[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyzeProject = async () => {
    setIsAnalyzing(true);
    // Simulate AI analysis
    setTimeout(() => {
      const mockInsights: LearningInsight[] = [
        {
          id: "1",
          type: "pattern",
          title: "Frequent Error Handling Pattern",
          description: "User often asks for error handling in async functions. Consider suggesting try-catch blocks proactively.",
          confidence: 0.85,
          frequency: 12
        },
        {
          id: "2", 
          type: "improvement",
          title: "Code Structure Preference",
          description: "User prefers modular architecture. Suggest breaking large files into smaller modules.",
          confidence: 0.92,
          frequency: 8
        },
        {
          id: "3",
          type: "suggestion",
          title: "Testing Approach",
          description: "User hasn't written tests yet. Suggest adding unit tests for core functions.",
          confidence: 0.78,
          frequency: 1
        }
      ];
      setInsights(mockInsights);
      setIsAnalyzing(false);
    }, 2000);
  };

  useEffect(() => {
    analyzeProject();
  }, [projectPath]);

  const getTypeColor = (type: string) => {
    switch (type) {
      case "pattern": return "bg-blue-100 text-blue-800";
      case "improvement": return "bg-green-100 text-green-800";
      case "suggestion": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "pattern": return <TrendingUp className="h-4 w-4" />;
      case "improvement": return <Brain className="h-4 w-4" />;
      case "suggestion": return <MessageSquare className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5" />
          AI Learning Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isAnalyzing ? (
          <div className="text-center py-8">
            <Brain className="h-8 w-8 mx-auto mb-2 animate-pulse" />
            <p>Analyzing project patterns...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => (
              <div key={insight.id} className="border rounded-lg p-3">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getTypeIcon(insight.type)}
                    <h4 className="font-medium text-sm">{insight.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={`text-xs ${getTypeColor(insight.type)}`}>
                      {insight.type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {Math.round(insight.confidence * 100)}%
                    </span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-2">{insight.description}</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    Seen {insight.frequency} times
                  </span>
                  <Button size="sm" variant="outline">Apply</Button>
                </div>
              </div>
            ))}
            
            <Button onClick={analyzeProject} variant="outline" className="w-full">
              <Brain className="h-4 w-4 mr-2" />
              Re-analyze Project
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}