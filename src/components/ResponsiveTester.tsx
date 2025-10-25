import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Tablet, Monitor, CheckCircle, XCircle } from "lucide-react";

const ResponsiveTester = () => {
  const [currentViewport, setCurrentViewport] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  const viewportSizes = {
    mobile: { width: 360, height: 640, icon: Smartphone },
    tablet: { width: 768, height: 1024, icon: Tablet },
    desktop: { width: 1024, height: 768, icon: Monitor }
  };

  const testComponents = [
    { id: "dashboard", name: "Dashboard Layout", description: "Sidebar collapses, main content adapts" },
    { id: "task-list", name: "Task List", description: "Cards resize, filters stack vertically" },
    { id: "payment-table", name: "Payment Table", description: "Table becomes scrollable, columns adapt" },
    { id: "chat-interface", name: "Chat Interface", description: "Message bubbles resize, input adapts" },
    { id: "auth-form", name: "Auth Forms", description: "Form elements scale appropriately" },
    { id: "dialogs", name: "Modal Dialogs", description: "Dialogs fit viewport, content scrolls" }
  ];

  const runTests = () => {
    // Simulate test results - in a real scenario, this would use actual DOM testing
    const results: Record<string, boolean> = {};
    testComponents.forEach(component => {
      // Simulate test passing for most components, randomize for demo
      results[component.id] = Math.random() > 0.2;
    });
    setTestResults(results);
  };

  const ViewportIcon = viewportSizes[currentViewport].icon;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ViewportIcon className="h-6 w-6" />
          Responsive Design Tester
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Viewport Selector */}
        <div className="flex flex-wrap gap-2">
          {Object.entries(viewportSizes).map(([key, { icon: Icon }]) => (
            <Button
              key={key}
              variant={currentViewport === key ? "default" : "outline"}
              onClick={() => setCurrentViewport(key as any)}
              className="flex items-center gap-2"
            >
              <Icon className="h-4 w-4" />
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </Button>
          ))}
        </div>

        {/* Viewport Preview */}
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
          <div className="text-center mb-4">
            <h3 className="font-semibold">Viewport: {currentViewport}</h3>
            <p className="text-sm text-muted-foreground">
              {viewportSizes[currentViewport].width}px × {viewportSizes[currentViewport].height}px
            </p>
          </div>
          
          <div 
            className="mx-auto border border-gray-200 bg-white overflow-hidden"
            style={{ 
              width: viewportSizes[currentViewport].width / 4, 
              height: viewportSizes[currentViewport].height / 4,
              transform: 'scale(0.5)',
              transformOrigin: 'top center'
            }}
          >
            <div className="w-full h-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <span className="text-xs font-mono">Preview</span>
            </div>
          </div>
        </div>

        {/* Test Controls */}
        <div className="flex gap-2">
          <Button onClick={runTests} className="flex-1">
            Run Responsive Tests
          </Button>
        </div>

        {/* Test Results */}
        {Object.keys(testResults).length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold">Test Results:</h4>
            {testComponents.map((component) => (
              <div key={component.id} className="flex items-center gap-3 p-3 border rounded-lg">
                {testResults[component.id] ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <div className="flex-1">
                  <div className="font-medium">{component.name}</div>
                  <div className="text-sm text-muted-foreground">{component.description}</div>
                </div>
                <span className={`text-sm font-medium ${testResults[component.id] ? 'text-green-600' : 'text-red-600'}`}>
                  {testResults[component.id] ? 'PASS' : 'FAIL'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Responsive Guidelines */}
        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-semibold mb-2">Mobile Responsive Guidelines:</h4>
          <ul className="text-sm space-y-1">
            <li>• Use mobile-first CSS approach (min-width media queries)</li>
            <li>• Ensure touch targets are at least 44×44 pixels</li>
            <li>• Use relative units (rem, em) for font sizes</li>
            <li>• Test on actual devices when possible</li>
            <li>• Consider landscape and portrait orientations</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default ResponsiveTester;