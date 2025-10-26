import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { ArduinoIntegration } from "@/components/arduino/arduino-integration";

export default function ArduinoPage() {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      
      <div className="lg:pl-64 flex flex-col flex-1">
        <Header title="Arduino Integration" subtitle="Monitor and manage connected Arduino sensors for real-time inventory tracking" />
        
        <main className="flex-1 p-4 lg:p-6 pt-24 lg:pt-20">
          <div className="max-w-7xl mx-auto bg-card rounded-lg border border-border p-6">
            <ArduinoIntegration />
          </div>
        </main>
      </div>
    </div>
  );
}