import { PerformanceTask } from "@/lib/langchain/schemas";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

interface PerformanceTaskSummaryProps {
  task: any;
  unitTitle?: string;
  gradeName?: string;
}

export function PerformanceTaskSummary({
  task,
  unitTitle,
  gradeName,
}: PerformanceTaskSummaryProps) {
  if (!task || Object.keys(task).length === 0) {
    return null;
  }

  // Format text as list items
  const formatList = (text: string | undefined) => {
    if (!text) return [];
    
    return text
      .split("\n")
      .filter((line) => line.trim().startsWith("-"))
      .map((line, index) => (
        <li key={index} className="ml-4 mt-2">
          {line.trim().slice(1).trim()}
        </li>
      ));
  };

  const requirementsList = formatList(task.requirements);
  const successCriteriaList = formatList(task.successCriteria);
  const focusTopicsList = formatList(task.suggestedFocusTopic);

  return (
    <Card className="mt-6 bg-white shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="bg-primary/5 border-b">
        <div className="flex justify-between">
          <div>
            <CardTitle className="text-xl font-bold">
              {task.title || "Performance Task"}
            </CardTitle>
            <CardDescription className="mt-1 font-medium text-gray-600">
              {task.subtitle}
            </CardDescription>
          </div>
          {unitTitle && (
            <Badge variant="outline" className="self-start text-xs">
              {unitTitle} • {gradeName} Grade
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="pt-4">
        <div className="prose prose-sm max-w-none">
          <h3 className="text-md font-medium mb-2">Description</h3>
          <p className="text-gray-700">{task.description}</p>

          <h3 className="text-md font-medium mt-4 mb-2">Purpose</h3>
          <p className="text-gray-700">{task.purpose}</p>
        </div>
      </CardContent>
      
      <CardFooter className="flex justify-end bg-gray-50 border-t">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" className="mr-2">
              See Details
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{task.title}</DialogTitle>
              <DialogDescription>{task.subtitle}</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="overview" className="mt-4">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="requirements">Requirements</TabsTrigger>
                <TabsTrigger value="criteria">Success Criteria</TabsTrigger>
                <TabsTrigger value="rubric">Rubric</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="p-4 rounded-md bg-gray-50">
                <h3 className="text-lg font-medium mb-2">Description</h3>
                <p className="mb-4">{task.description}</p>

                <h3 className="text-lg font-medium mb-2">Purpose</h3>
                <p className="mb-4">{task.purpose}</p>

                {focusTopicsList.length > 0 && (
                  <>
                    <h3 className="text-lg font-medium mb-2">
                      Suggested Focus Topics
                    </h3>
                    <ul className="list-disc">{focusTopicsList}</ul>
                  </>
                )}
              </TabsContent>

              <TabsContent value="requirements" className="p-4 rounded-md bg-gray-50">
                <h3 className="text-lg font-medium mb-2">Requirements</h3>
                <ul className="list-disc">{requirementsList}</ul>
              </TabsContent>

              <TabsContent value="criteria" className="p-4 rounded-md bg-gray-50">
                <h3 className="text-lg font-medium mb-2">Success Criteria</h3>
                <p className="mb-4">
                  Students can demonstrate their learning through:
                </p>
                <ul className="list-disc">{successCriteriaList}</ul>
              </TabsContent>

              <TabsContent value="rubric" className="p-4 rounded-md bg-gray-50">
                <h3 className="text-lg font-medium mb-2">
                  {task.rubricTitle || "Performance Assessment Rubric"}
                </h3>
                <p className="mb-4">{task.rubricDescription}</p>

                <div className="grid grid-cols-1 gap-4 mt-4">
                  {task.rubricCriteria?.map((criterion: any) => (
                    <Card key={criterion.orderNumber} className="border shadow-sm">
                      <CardHeader className="py-3 px-4 bg-primary/5">
                        <CardTitle className="text-md">
                          {criterion.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-3 px-4">
                        <p className="text-sm">{criterion.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline">
                Close
              </Button>
              <Button onClick={() => window.print()}>Print</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Button onClick={() => window.print()}>Print</Button>
      </CardFooter>
    </Card>
  );
} 