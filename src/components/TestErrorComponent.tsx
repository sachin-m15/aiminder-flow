import { useState } from "react";
import { Button } from "@/components/ui/button";
import ErrorBoundary from "@/components/ui/error-boundary";

// Component that throws an error when triggered
const ErrorThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Test error: This component intentionally crashed!");
  }

  return (
    <div className="p-4 border rounded-lg bg-green-50">
      <p className="text-green-700">Component is working normally</p>
    </div>
  );
};

// Test component to demonstrate error boundary functionality
const TestErrorComponent = () => {
  const [shouldThrow, setShouldThrow] = useState(false);

  return (
    <div className="p-6 space-y-4">
      <h2 className="text-2xl font-bold">Error Boundary Test</h2>
      <p className="text-muted-foreground">
        This component tests the error boundary functionality by intentionally throwing errors.
      </p>
      
      <div className="space-y-2">
        <Button 
          onClick={() => setShouldThrow(true)}
          variant="destructive"
        >
          Throw Error (Test Error Boundary)
        </Button>
        
        <Button 
          onClick={() => setShouldThrow(false)}
          variant="secondary"
        >
          Reset Component
        </Button>
      </div>

      <div className="border-t pt-4">
        <ErrorBoundary componentName="TestErrorComponent">
          <ErrorThrowingComponent shouldThrow={shouldThrow} />
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default TestErrorComponent;