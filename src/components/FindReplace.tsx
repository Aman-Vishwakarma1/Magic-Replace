import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Replace,
  Eye,
  CheckCircle,
  XCircle,
  Loader2,
  List,
  ChevronRight,
  FileText,
  MousePointerClick,
  ClipboardCheck,
  Sparkles, // NEW: Icon for Smart Replace
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// --- INTERFACES UPDATED TO MATCH ALL API STRUCTURES ---

interface ContentType {
  uid: string;
  title: string;
}

interface Entry {
  uid: string;
  title: string;
}

interface ScanResult {
  entryUid: string;
  field: string;
  before: string;
  title: string;
}

interface ChangeDetail {
  field: string;
  before: string;
  after: string;
  brandkit_approved?: boolean;
}

interface PreviewResult {
  entryUid: string;
  title: string;
  changes: ChangeDetail[];
}

interface ApplyResultDetail {
  entryUid: string;
  title: string;
  status: "updated" | "failed";
  changes?: ChangeDetail[];
  error?: string;
}

interface ApplyResult {
  totalUpdated: number;
  results: ApplyResultDetail[];
}

const API_BASE = "https://magic-replace-backend.vercel.app";

const Stepper = ({
  currentStep,
}: {
  currentStep: "select" | "scan" | "preview" | "apply";
}) => {
  const steps = [
    { id: "select", title: "Select Content", icon: MousePointerClick },
    { id: "scan", title: "Scan Content", icon: Search },
    { id: "preview", title: "Preview & Approve", icon: Eye },
    { id: "apply", title: "Apply Changes", icon: ClipboardCheck },
  ];

  const stepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center border-b border-gray-200 pb-8 mb-10 relative">
      <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent bottom-0" />
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center z-10">
          <div className="flex flex-col items-center">
            <div
              className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all duration-300
                ${
                  index <= stepIndex
                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-lg shadow-blue-500/20"
                    : "border-gray-300 bg-gray-100 text-gray-500"
                }
              `}
            >
              <step.icon className="h-6 w-6" />
            </div>
            <p
              className={`mt-3 text-sm font-medium transition-colors duration-300
                ${index <= stepIndex ? "text-blue-700" : "text-gray-500"}
              `}
            >
              {step.title}
            </p>
          </div>
          {index < steps.length - 1 && (
            <div
              className={`w-20 h-0.5 mx-4 rounded-full transition-all duration-300
                ${index < stepIndex ? "bg-blue-500" : "bg-gray-300"}
              `}
            />
          )}
        </div>
      ))}
    </div>
  );
};

export default function FindReplace() {
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [selectedContentType, setSelectedContentType] = useState<string>("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [replaceWith, setReplaceWith] = useState("");
  // NEW: State to control the AI-powered smart replace feature.
  const [isSmartReplace, setIsSmartReplace] = useState(false);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [previewResults, setPreviewResults] = useState<PreviewResult[]>([]);
  const [applyResults, setApplyResults] = useState<ApplyResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"select" | "scan" | "preview" | "apply">(
    "select"
  );
  const [selectedChanges, setSelectedChanges] = useState<
    Record<string, string[]>
  >({});
  const { toast } = useToast();

  useEffect(() => {
    loadContentTypes();
  }, []);

  useEffect(() => {
    if (selectedContentType) {
      loadEntries();
    } else {
      setEntries([]);
    }
    setSelectedEntries([]);
  }, [selectedContentType]);

  const loadContentTypes = async () => {
    try {
      const response = await fetch(`${API_BASE}/content-types`);
      const data = await response.json();
      setContentTypes(data.contentTypes || data || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load content types",
        variant: "destructive",
      });
    }
  };

  const loadEntries = async () => {
    if (!selectedContentType) return;
    try {
      const response = await fetch(
        `${API_BASE}/entries?contentTypeUid=${selectedContentType}`
      );
      const data = await response.json();
      setEntries(data.entries || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load entries",
        variant: "destructive",
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedEntries(checked ? entries.map((e) => e.uid) : []);
  };

  const handleSelectEntry = (entryUid: string, checked: boolean) => {
    setSelectedEntries((prev) =>
      checked ? [...prev, entryUid] : prev.filter((uid) => uid !== entryUid)
    );
  };

  const handleScan = async () => {
    if (
      !selectedContentType ||
      !searchQuery.trim() ||
      selectedEntries.length === 0
    )
      return;
    setLoading(true);
    setPreviewResults([]);
    setApplyResults(null);
    try {
      const params = new URLSearchParams({
        contentTypeUid: selectedContentType,
        query: searchQuery,
      });
      selectedEntries.forEach((uid) => params.append("entryUids", uid));

      const response = await fetch(`${API_BASE}/scan?${params.toString()}`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();

      setScanResults(data.matches || []);
      setStep("scan");
      toast({
        title: "Scan Complete",
        description: `Found ${data.totalMatches} matches across ${selectedEntries.length} selected entries.`,
      });
    } catch (error) {
      console.error("Scan failed:", error);
      toast({
        title: "Error",
        description: "Failed to scan content.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // CHANGED: This function now sends the 'smart' flag to the backend.
  const handlePreview = async () => {
    if (
      !selectedContentType ||
      !searchQuery.trim() ||
      !replaceWith.trim() ||
      selectedEntries.length === 0
    )
      return;
    setLoading(true);
    setScanResults([]);
    setApplyResults(null);
    try {
      const params = new URLSearchParams({
        contentTypeUid: selectedContentType,
        query: searchQuery,
        replaceWith: replaceWith,
      });
      selectedEntries.forEach((uid) => params.append("entryUids", uid));

      // NEW: Append the 'smart' parameter if the user has enabled it.
      if (isSmartReplace) {
        params.append("smart", "true");
      }

      const response = await fetch(`${API_BASE}/preview?${params.toString()}`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      const previewData = data.preview || [];
      setPreviewResults(previewData);

      const initialSelections: Record<string, string[]> = {};
      previewData.forEach((entry: PreviewResult) => {
        initialSelections[entry.entryUid] = entry.changes
          .filter((c) => c.brandkit_approved !== false)
          .map((c) => c.field);
      });
      setSelectedChanges(initialSelections);

      setStep("preview");
      const allChanges = previewData.flatMap(
        (entry: PreviewResult) => entry.changes
      );
      const approved = allChanges.filter(
        (c: ChangeDetail) => c.brandkit_approved !== false
      ).length;
      const rejected = allChanges.length - approved;

      toast({
        title: "Preview Ready",
        description: `${approved} changes approved, ${rejected} rejected by Brandkit`,
      });
    } catch (error) {
      console.error("Preview failed:", error);
      toast({
        title: "Error",
        description: "Failed to generate preview.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleChangeSelection = (
    entryUid: string,
    field: string,
    checked: boolean
  ) => {
    setSelectedChanges((prev) => {
      const currentFields = prev[entryUid] || [];
      const newFields = checked
        ? [...currentFields, field]
        : currentFields.filter((f) => f !== field);
      return { ...prev, [entryUid]: newFields };
    });
  };

  const handleSelectAllForEntry = (entry: PreviewResult, checked: boolean) => {
    const allApprovableFields = entry.changes
      .filter((c) => c.brandkit_approved !== false)
      .map((c) => c.field);

    setSelectedChanges((prev) => ({
      ...prev,
      [entry.entryUid]: checked ? allApprovableFields : [],
    }));
  };

  const handleApply = async () => {
    setLoading(true);
    try {
      const changesToApply = [];
      previewResults.forEach((entry) => {
        const selectedFieldsForEntry = selectedChanges[entry.entryUid] || [];
        entry.changes.forEach((change) => {
          if (selectedFieldsForEntry.includes(change.field)) {
            changesToApply.push({
              entryUid: entry.entryUid,
              field: change.field,
              newValue: change.after,
            });
          }
        });
      });

      if (changesToApply.length === 0) {
        toast({
          title: "No changes selected",
          description: "Please select at least one change to apply.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contentTypeUid: selectedContentType,
          changes: changesToApply,
        }),
      });
      const data = await response.json();
      setApplyResults(data);
      setStep("apply");

      const failedCount = (data.results || []).filter(
        (r: ApplyResultDetail) => r.status === "failed"
      ).length;
      toast({
        title: "Changes Applied",
        description: `${data.totalUpdated} entries updated, ${failedCount} failed`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to apply changes",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetFlow = () => {
    setStep("select");
    setSelectedContentType("");
    setEntries([]);
    setSelectedEntries([]);
    setScanResults([]);
    setPreviewResults([]);
    setApplyResults(null);
    setSearchQuery("");
    setReplaceWith("");
    setSelectedChanges({});
    setIsSmartReplace(false); // Reset smart replace flag
  };

  const isAllSelected =
    entries.length > 0 && selectedEntries.length === entries.length;

  const groupedScanResults = scanResults.reduce((acc, result) => {
    const { entryUid, title } = result;
    if (!acc[entryUid]) {
      acc[entryUid] = { title, uid: entryUid, matches: [] };
    }
    acc[entryUid].matches.push(result);
    return acc;
  }, {} as Record<string, { title: string; uid: string; matches: ScanResult[] }>);

  return (
    <div className="min-h-screen p-6 bg-gray-50 text-gray-800 font-sans antialiased">
      <div className="max-w-7xl mx-auto space-y-12">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 drop-shadow-md">
            Magic Replace
          </h1>
          <p className="text-gray-500 text-lg">
            AI-powered content replacement.
          </p>
        </div>

        <Stepper currentStep={step} />

        <div className="grid grid-cols-1 lg:grid-cols-3 lg:gap-12">
          {/* --- LEFT COLUMN: SETUP --- */}
          <div className="lg:col-span-1 space-y-8">
            <Card className="rounded-2xl border border-gray-200 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-gray-300/50 transition-all duration-300">
              <CardHeader className="border-b border-gray-200 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl text-blue-700">
                  <MousePointerClick className="h-6 w-6" />
                  1. Select Content
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-gray-700">
                    Content Type
                  </Label>
                  <Select
                    value={selectedContentType}
                    onValueChange={setSelectedContentType}
                  >
                    <SelectTrigger className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors">
                      <SelectValue placeholder="Select a content type" />
                    </SelectTrigger>
                    <SelectContent>
                      {contentTypes.map((type) => (
                        <SelectItem key={type.uid} value={type.uid}>
                          {type.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {entries.length > 0 && (
                  <div className="space-y-3">
                    <Label className="text-sm font-semibold text-gray-700">
                      Select Entries ({selectedEntries.length} /{" "}
                      {entries.length} selected)
                    </Label>
                    <div className="border border-gray-300 rounded-lg overflow-hidden">
                      <div className="flex items-center space-x-2 p-3 border-b border-gray-200 bg-gray-100">
                        <Checkbox
                          id="select-all"
                          className="rounded-md border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                          checked={isAllSelected}
                          onCheckedChange={(checked) =>
                            handleSelectAll(Boolean(checked))
                          }
                        />
                        <Label
                          htmlFor="select-all"
                          className="font-semibold text-sm text-gray-700"
                        >
                          {isAllSelected ? "Deselect All" : "Select All"}
                        </Label>
                      </div>
                      <ScrollArea className="h-60">
                        <div className="p-1">
                          {entries.map((entry) => (
                            <div
                              key={entry.uid}
                              className="flex items-center space-x-2 px-2 py-3 hover:bg-gray-100 transition-colors duration-200 rounded-md"
                            >
                              <Checkbox
                                id={entry.uid}
                                className="rounded-md border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                checked={selectedEntries.includes(entry.uid)}
                                onCheckedChange={(checked) =>
                                  handleSelectEntry(entry.uid, Boolean(checked))
                                }
                              />
                              <Label
                                htmlFor={entry.uid}
                                className="font-normal text-sm w-full cursor-pointer text-gray-600"
                              >
                                {entry.title}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border border-gray-200 shadow-xl shadow-gray-200/50 hover:shadow-2xl hover:shadow-gray-300/50 transition-all duration-300">
              <CardHeader className="border-b border-gray-200 pb-4">
                <CardTitle className="flex items-center gap-2 text-xl text-blue-700">
                  <FileText className="h-6 w-6" />
                  2. Define Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2">
                  <Label
                    htmlFor="searchQuery"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Find
                  </Label>
                  <Input
                    id="searchQuery"
                    placeholder="Enter text to find..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="replaceWith"
                    className="text-sm font-semibold text-gray-700"
                  >
                    Replace With
                  </Label>
                  <Input
                    id="replaceWith"
                    placeholder="Enter replacement text..."
                    value={replaceWith}
                    onChange={(e) => setReplaceWith(e.target.value)}
                    className="rounded-lg border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-colors"
                  />
                </div>
                {/* --- NEW: Smart Replace Checkbox --- */}
                <div className="flex items-center space-x-3 pt-2">
                  <Checkbox
                    id="smart-replace"
                    className="rounded-md border-gray-400 data-[state=checked]:bg-purple-600 data-[state=checked]:border-purple-600"
                    checked={isSmartReplace}
                    onCheckedChange={(checked) =>
                      setIsSmartReplace(Boolean(checked))
                    }
                  />
                  <Label
                    htmlFor="smart-replace"
                    className="font-medium flex items-center gap-2 cursor-pointer text-gray-700"
                  >
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    Use Smart Replace
                    <Badge
                      variant="outline"
                      className="text-purple-600 border-purple-300 bg-purple-50 rounded-full font-bold px-3"
                    >
                      AI
                    </Badge>
                  </Label>
                </div>
                <div className="flex flex-col space-y-3 pt-4">
                  <Button
                    onClick={handleScan}
                    disabled={
                      !selectedContentType ||
                      !searchQuery.trim() ||
                      selectedEntries.length === 0 ||
                      loading
                    }
                    className="w-full text-white font-bold py-6 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                  >
                    {loading && step === "scan" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="mr-2 h-4 w-4" />
                    )}
                    Scan Content
                  </Button>
                  <Button
                    onClick={handlePreview}
                    disabled={
                      !selectedContentType ||
                      !searchQuery.trim() ||
                      !replaceWith.trim() ||
                      selectedEntries.length === 0 ||
                      loading
                    }
                    variant="outline"
                    className={`w-full font-bold py-6 rounded-xl border-2 transition-all
                      ${
                        isSmartReplace
                          ? "bg-purple-600 text-white border-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-500/20"
                          : "border-gray-300 text-gray-700 hover:bg-gray-200"
                      }
                    `}
                  >
                    {loading && step === "preview" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : isSmartReplace ? (
                      <Sparkles className="mr-2 h-4 w-4" />
                    ) : (
                      <Eye className="mr-2 h-4 w-4" />
                    )}
                    {isSmartReplace ? "Smart Preview" : "Preview Changes"}
                  </Button>
                  <Button
                    onClick={resetFlow}
                    variant="ghost"
                    className="w-full font-semibold text-gray-500 hover:text-blue-600"
                  >
                    Start Over
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* --- RIGHT COLUMN: RESULTS --- */}
          <div className="lg:col-span-2">
            {step === "select" && (
              <div className="h-full flex flex-col items-center justify-center bg-gray-100 rounded-2xl p-12 border-2 border-dashed border-gray-300">
                <div className="text-center">
                  <List className="mx-auto h-16 w-16 text-gray-400" />
                  <h3 className="mt-4 text-xl font-medium text-gray-800">
                    Results will appear here
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    Complete the setup steps on the left to begin.
                  </p>
                </div>
              </div>
            )}

            {step === "scan" && (
              <Card className="rounded-2xl border border-gray-200 shadow-xl shadow-gray-200/50">
                <CardHeader className="border-b border-gray-200 pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl text-blue-700">
                    <Search className="h-6 w-6" />
                    Scan Results
                  </CardTitle>
                  <CardDescription>
                    Found {scanResults.length} instances of your search query.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <Accordion type="multiple" className="w-full">
                    {Object.values(groupedScanResults).map((entry) => (
                      <AccordionItem
                        value={entry.uid}
                        key={entry.uid}
                        className="border-b border-gray-200 last:border-b-0"
                      >
                        <AccordionTrigger className="font-semibold text-gray-800 hover:no-underline">
                          <div className="flex-1 text-left">
                            <h4 className="font-bold">{entry.title}</h4>
                            <p className="font-normal text-gray-500 text-sm">
                              {entry.uid}
                            </p>
                          </div>
                          <span className="font-medium text-blue-600 ml-4 bg-blue-100 py-1 px-3 rounded-full text-xs">
                            {entry.matches.length} matches
                          </span>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                            {entry.matches.map((result, index) => (
                              <div key={index} className="pl-4">
                                <p className="text-xs text-blue-600 font-mono mb-1">
                                  {result.field}
                                </p>
                                <div className="bg-gray-100 rounded-lg p-3 border border-gray-200 shadow-inner">
                                  <p className="text-sm font-mono whitespace-pre-wrap text-gray-700">
                                    {result.before}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )}

            {step === "preview" && (
              <Card className="rounded-2xl border border-gray-200 shadow-xl shadow-gray-200/50">
                <CardHeader className="border-b border-gray-200 pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl text-blue-700">
                    <Eye className="h-6 w-6" />
                    Preview & Approve Changes
                  </CardTitle>
                  <CardDescription>
                    Select the changes you wish to apply, then click the "Apply"
                    button at the bottom.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <Accordion
                    type="multiple"
                    className="w-full"
                    defaultValue={previewResults.map((e) => e.entryUid)}
                  >
                    {previewResults.map((entry, entryIndex) => {
                      const selectedCount =
                        selectedChanges[entry.entryUid]?.length || 0;
                      const totalApprovable = entry.changes.filter(
                        (c) => c.brandkit_approved !== false
                      ).length;
                      const isAllForEntrySelected =
                        selectedCount === totalApprovable &&
                        totalApprovable > 0;

                      return (
                        <AccordionItem
                          value={entry.entryUid}
                          key={entry.entryUid}
                          className="border-b border-gray-200 last:border-b-0"
                        >
                          <AccordionTrigger className="font-semibold text-gray-800 hover:no-underline">
                            <div className="flex-1 text-left">
                              <h4 className="font-bold">{entry.title}</h4>
                              <p className="text-sm text-gray-500 font-normal">
                                {entry.entryUid}
                              </p>
                            </div>
                            {totalApprovable > 0 && (
                              <div
                                className="flex items-center space-x-2 pr-4"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  id={`select-all-${entry.entryUid}`}
                                  className="rounded-md border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                  checked={isAllForEntrySelected}
                                  onCheckedChange={(checked) =>
                                    handleSelectAllForEntry(
                                      entry,
                                      Boolean(checked)
                                    )
                                  }
                                />
                                <Label
                                  htmlFor={`select-all-${entry.entryUid}`}
                                  className="text-sm font-medium text-gray-700"
                                >
                                  Select All ({selectedCount}/{totalApprovable})
                                </Label>
                              </div>
                            )}
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="p-2 space-y-6">
                              {entry.changes.map((change, changeIndex) => (
                                <div
                                  key={changeIndex}
                                  className="border-l-2 border-blue-200 pl-4"
                                >
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center space-x-3">
                                      {change.brandkit_approved !== false && (
                                        <Checkbox
                                          id={`${entry.entryUid}-${change.field}`}
                                          className="rounded-md border-gray-400 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                          checked={
                                            selectedChanges[
                                              entry.entryUid
                                            ]?.includes(change.field) || false
                                          }
                                          onCheckedChange={(checked) =>
                                            handleToggleChangeSelection(
                                              entry.entryUid,
                                              change.field,
                                              Boolean(checked)
                                            )
                                          }
                                        />
                                      )}
                                      <p className="text-sm text-blue-600 font-mono">
                                        {change.field}
                                      </p>
                                    </div>
                                    {change.brandkit_approved !== false ? (
                                      <Badge
                                        variant="default"
                                        className="bg-green-100 text-green-800 border-green-200 font-semibold px-3 rounded-full"
                                      >
                                        <CheckCircle className="h-3 w-3 mr-1" />{" "}
                                        Approved
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="destructive"
                                        className="font-semibold px-3 rounded-full"
                                      >
                                        <XCircle className="h-3 w-3 mr-1" />{" "}
                                        Rejected
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:pl-8">
                                    <div>
                                      <Label className="text-xs font-semibold text-gray-500">
                                        Before
                                      </Label>
                                      <div className="bg-gray-100 rounded-lg p-3 mt-1 border border-gray-200">
                                        <p className="text-sm font-mono whitespace-pre-wrap text-gray-700">
                                          {change.before}
                                        </p>
                                      </div>
                                    </div>
                                    <div>
                                      <Label className="text-xs font-semibold text-gray-500">
                                        After
                                      </Label>
                                      <div
                                        className={`rounded-lg p-3 mt-1 border
                                          ${
                                            change.brandkit_approved !== false
                                              ? "bg-green-50 border-green-200"
                                              : "bg-red-50 border-red-200"
                                          }
                                        `}
                                      >
                                        <p className="text-sm font-mono whitespace-pre-wrap text-gray-700">
                                          {change.after}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                  <div className="mt-8 border-t border-gray-200 pt-6 flex gap-3">
                    <Button
                      onClick={handleApply}
                      disabled={loading}
                      className="w-full text-white font-bold py-6 rounded-xl bg-blue-600 hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                    >
                      {loading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Replace className="mr-2 h-4 w-4" />
                      )}
                      Apply Selected Changes
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {step === "apply" && (
              <Card className="rounded-2xl border border-gray-200 shadow-xl shadow-gray-200/50">
                <CardHeader className="border-b border-gray-200 pb-4">
                  <CardTitle className="flex items-center gap-2 text-xl text-blue-700">
                    <ClipboardCheck className="h-6 w-6" />
                    Apply Summary
                  </CardTitle>
                  <CardDescription>
                    Review the results of the apply operation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {(() => {
                      if (!applyResults) return null;
                      const updatedEntries = applyResults.results.filter(
                        (r) => r.status === "updated"
                      );
                      const failedEntries = applyResults.results.filter(
                        (r) => r.status === "failed"
                      );

                      return (
                        <>
                          {updatedEntries.length > 0 && (
                            <div>
                              <h4 className="font-bold text-green-600 mb-3 flex items-center gap-2 text-lg">
                                <CheckCircle className="h-5 w-5" />
                                Successfully Updated ({updatedEntries.length})
                              </h4>
                              <div className="space-y-3">
                                {updatedEntries.map((result, index) => (
                                  <div
                                    key={index}
                                    className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg"
                                  >
                                    <div>
                                      <p className="font-medium text-gray-800">
                                        {result.title}
                                      </p>
                                      <p className="text-sm text-gray-500">
                                        {result.entryUid}
                                      </p>
                                    </div>
                                    <Badge
                                      variant="default"
                                      className="bg-green-600 text-white font-bold rounded-full px-3"
                                    >
                                      {updatedEntries.length || 0} changes
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {failedEntries.length > 0 && (
                            <div>
                              <h4 className="font-bold text-red-600 mb-3 flex items-center gap-2 text-lg">
                                <XCircle className="h-5 w-5" />
                                Failed Updates ({failedEntries.length})
                              </h4>
                              <div className="space-y-3">
                                {failedEntries.map((result, index) => (
                                  <div
                                    key={index}
                                    className="p-4 bg-red-50 border border-red-200 rounded-lg"
                                  >
                                    <div className="flex items-center justify-between mb-1">
                                      <p className="font-medium text-gray-800">
                                        {result.title}
                                      </p>
                                      <Badge
                                        variant="secondary"
                                        className="font-semibold text-gray-600 rounded-full"
                                      >
                                        {result.entryUid}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-red-700 font-mono mt-2">
                                      {result.error ||
                                        "An unknown error occurred."}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                    <div className="border-t border-gray-200 pt-6 flex gap-3">
                      <Button
                        onClick={resetFlow}
                        variant="outline"
                        className="w-full font-bold py-6 rounded-xl border-2 border-gray-300 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        Start New Search
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
