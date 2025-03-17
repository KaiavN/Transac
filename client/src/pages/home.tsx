import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth-context";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { user, login, updateUser } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleJoinOrganization = async () => {
    if (!user) {
      toast({
        title: "Authentication required",
        description: "You must be logged in to join an organization",
        variant: "destructive"
      });
      return;
    }

    if (!organizationId.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter an organization ID",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/organizations/${organizationId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to join organization");
      }

      // Refresh user data to get updated organization status
      if (updateUser) {
        await updateUser(user);
      }

      toast({
        title: "Request sent",
        description: "Your request to join the organization has been sent"
      });

      // Clear the input field
      setOrganizationId("");
    } catch (error) {
      console.error("Join organization error:", error);
      toast({
        title: "Failed to join organization",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast({
        title: "Missing information",
        description: "Please enter your email and password",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    try {
      await login(
        email,
        fullName,
        password,
        {
          type: 'credit_card',
          token: 'placeholder',
          receivePaymentsTo: 'bank_account',
          receivePaymentsDetails: 'placeholder'
        }
      );
      toast({
        title: "Success",
        description: "You've been logged in successfully"
      });
    } catch (error) {
      console.error('Login failed:', error);
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      const width = 500;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
    
      // Generate a random state parameter for security
      const state = crypto.randomUUID();
      sessionStorage.setItem('oauthState', state);
  
      // Ensure we're using the correct redirect URI that matches server configuration
      const redirectUri = `${window.location.origin}/auth/google/callback`;
      
      const params = new URLSearchParams({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'email profile openid',
        access_type: 'offline',
        prompt: 'consent',
        state
      });
  
      const popup = window.open(
        `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        'Google Sign In',
        `width=${width},height=${height},left=${left},top=${top}`
      );
    
      if (popup) {
        const checkPopup = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkPopup);
            window.removeEventListener('message', handleAuthMessage);
            setIsLoading(false);
          }
        }, 1000);
    
        // Use a named function so we can remove the event listener later
        const handleAuthMessage = async (event: MessageEvent) => {
          if (event.origin === window.location.origin && event.data?.type === 'google-auth') {
            const { email, fullName, sessionId } = event.data;
            const storedState = sessionStorage.getItem('oauthState');
            
            if (!storedState || storedState !== state) {
              console.error('Invalid OAuth state');
              setIsLoading(false);
              return;
            }
            
            try {
              // Store the session ID for subsequent API requests
              if (sessionId) {
                localStorage.setItem('session-id', sessionId);
              }
              
              // The session cookie is already set by the server
              // Just need to verify auth to get the user data
              await login(
                email,
                fullName,
                '', // No password for Google sign-in
                {
                  type: 'credit_card',
                  token: 'placeholder',
                  receivePaymentsTo: 'bank_account',
                  receivePaymentsDetails: 'placeholder'
                }
              );

              toast({
                title: "Success",
                description: "You've been logged in with Google successfully"
              });
            } catch (error) {
              console.error('Google login failed:', error);
              toast({
                title: "Google login failed",
                description: error instanceof Error ? error.message : "An unexpected error occurred",
                variant: "destructive"
              });
            } finally {
              sessionStorage.removeItem('oauthState');
              window.removeEventListener('message', handleAuthMessage);
              clearInterval(checkPopup);
              popup.close();
              setIsLoading(false);
            }
          }
        };
        
        // Register the event listener
        window.addEventListener('message', handleAuthMessage);
      } else {
        setIsLoading(false);
        toast({
          title: "Popup blocked",
          description: "Please allow popups for this site to use Google sign in",
          variant: "destructive"
        });
      }
    } catch (error) {
      setIsLoading(false);
      console.error('Google sign in error:', error);
      toast({
        title: "Error",
        description: "Failed to initiate Google sign in",
        variant: "destructive"
      });
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-md">
        <Card className="p-6 space-y-4">
          <h1 className="text-2xl font-bold text-center">Welcome to Transac</h1>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="mb-2"
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing In...</> : 'Sign In'}
            </Button>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              type="button"
            >
              {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : 'Sign in with Google'}
            </Button>
            <Button variant="link" asChild className="w-full" disabled={isLoading}>
              <Link href="/register">Create an account</Link>
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 min-h-screen">
      <div className="grid gap-6 pb-16">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user.fullName || 'User'}</h1>
            <p className="text-sm text-muted-foreground mt-1">User ID: {user.id}</p>
          </div>
          <Button asChild>
            <Link href="/generate">Create New Contract</Link>
          </Button>
        </div>
        
        <Card className="p-4">
          <h2 className="text-xl font-semibold mb-2">Your Digital Signature</h2>
          <p className="font-mono bg-muted p-2 rounded">{user.signatureKey || 'Not set'}</p>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-4 border-2 border-primary/20 hover:border-primary/50 transition-colors">
            <h2 className="text-xl font-semibold mb-4">Organization</h2>
            {user.organizationId ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">Organization ID: {user.organizationId}</p>
                    {user.isBusinessAccount && (
                      <p className="text-sm text-green-600 font-medium">Business Account Active</p>
                    )}
                  </div>
                  <Button asChild size="lg" className="bg-primary hover:bg-primary/90">
                    <Link href="/organization">
                      <span className="flex items-center">View Dashboard</span>
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">No organization linked</p>
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Enter Organization ID"
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                  />
                  <Button 
                    className="w-full" 
                    onClick={handleJoinOrganization}
                    disabled={isLoading || !organizationId.trim()}
                  >
                    {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Joining...</> : 'Join Organization'}
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or</span>
                    </div>
                  </div>
                  <Button asChild className="w-full">
                    <Link href="/create-organization">Create Organization</Link>
                  </Button>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4">Active Contracts</h2>
            {/* Add null check for contracts here */}
            {!user.contracts || user.contracts.length === 0 ? (
              <p className="text-muted-foreground">No active contracts</p>
            ) : (
              <ul className="space-y-2">
                {user.contracts.map((contract, index) => (
                  <li key={contract || index} className="p-2 bg-muted rounded">
                    Contract ID: {contract}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}