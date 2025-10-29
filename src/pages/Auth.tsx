import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { loginSchema, signupSchema, type LoginFormData, type SignupFormData } from "@/lib/validation";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import ErrorBoundary from "@/components/ui/error-boundary";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");

  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const handleLogin = async (data: LoginFormData) => {
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;
      toast.success("Logged in successfully!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to log in");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (data: SignupFormData) => {
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
      toast.success("Account created successfully!");
      navigate("/");
    } catch (error: any) {
      toast.error(error.message || "Failed to sign up");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ErrorBoundary componentName="Auth">
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
        <Card className="w-full max-w-sm md:max-w-md mx-2">
          <CardHeader className="space-y-1">
            <CardTitle className="text-3xl font-bold text-center" id="auth-title">
              ChatFlow Agent
            </CardTitle>
            <CardDescription className="text-center" id="auth-description">
              AI-Powered Task Management System
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              defaultValue="login"
              className="w-full"
              onValueChange={setActiveTab}
              aria-labelledby="auth-title"
            >
              <TabsList className="grid w-full grid-cols-2" role="tablist">
                <TabsTrigger value="login" role="tab" aria-selected={activeTab === "login"} className="text-xs md:text-sm">
                  Login
                </TabsTrigger>
                <TabsTrigger value="signup" role="tab" aria-selected={activeTab === "signup"} className="text-xs md:text-sm">
                  Sign Up
                </TabsTrigger>
              </TabsList>
              <TabsContent value="login" role="tabpanel" aria-labelledby="login-tab">
                <Form {...loginForm}>
                  <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                    <FormField
                      control={loginForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="email">Email</FormLabel>
                          <FormControl>
                            <Input
                              id="email"
                              type="email"
                              placeholder="you@example.com"
                              aria-describedby="email-description"
                              autoComplete="email"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={loginForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="password">Password</FormLabel>
                          <FormControl>
                            <Input
                              id="password"
                              type="password"
                              autoComplete="current-password"
                              aria-describedby="password-description"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading}
                      aria-busy={loading}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                      Log In
                    </Button>
                  </form>
                </Form>
              </TabsContent>
              <TabsContent value="signup" role="tabpanel" aria-labelledby="signup-tab">
                <Form {...signupForm}>
                  <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                    <FormField
                      control={signupForm.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="fullName">Full Name</FormLabel>
                          <FormControl>
                            <Input
                              id="fullName"
                              type="text"
                              placeholder="John Doe"
                              autoComplete="name"
                              aria-describedby="name-description"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="signup-email">Email</FormLabel>
                          <FormControl>
                            <Input
                              id="signup-email"
                              type="email"
                              placeholder="you@example.com"
                              autoComplete="email"
                              aria-describedby="signup-email-description"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={signupForm.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel htmlFor="signup-password">Password</FormLabel>
                          <FormControl>
                            <Input
                              id="signup-password"
                              type="password"
                              autoComplete="new-password"
                              aria-describedby="password-requirements"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={loading}
                      aria-busy={loading}
                    >
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}
                      Sign Up
                    </Button>
                  </form>
                </Form>
              </TabsContent>
            </Tabs>
          </CardContent>
          </Card>
      </div>
    </ErrorBoundary>
  );
};

export default Auth;