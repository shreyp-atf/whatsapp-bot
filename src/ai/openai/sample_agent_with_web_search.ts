import { webSearchTool, Agent, AgentInputItem, Runner, withTrace } from "@openai/agents";
import { z } from "zod";

import dotenv from 'dotenv';
dotenv.config();


// Tool definitions
const webSearchPreview = webSearchTool({
  searchContextSize: "medium",
  userLocation: {
    city: "Gurugram",
    country: "IN",
    region: "Haryana",
    type: "approximate"
  }
})
// Define the output schema based on the EventsResponse JSON schema
const TimingSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  is_ticketed: z.boolean(),
  min_price: z.number().min(0).nullable(),
  duration: z.string().min(1).nullable()
});

const VenueSchema = z.object({
  venue_name: z.string().min(1),
  venue_address: z.string().min(1),
  locality_name: z.string().min(1),
  city: z.string().min(1),
  timings: z.array(TimingSchema),
  booking_links: z.array(z.string().min(1).regex(/^https?:\/\/.+/)),
  confidence: z.enum(["high", "medium", "low"]),
  extraction_notes: z.string().min(1)
});

const EventSchema = z.object({
  activity: z.string().min(1),
  venues: z.array(VenueSchema)
});

const WebResearchAgentSchema = z.object({
  events: z.array(EventSchema)
});
const webResearchAgent = new Agent({
  name: "Web Research agent",
  instructions: "Extract event information from web content. For each event, identify the activity name and all associated venues. For each venue, extract the venue details, timings, booking links, and provide confidence level and extraction notes. Use web search to find comprehensive event information.",
  model: "gpt-5-nano",
  tools: [
    webSearchPreview
  ],
  outputType: WebResearchAgentSchema,
  modelSettings: {
    reasoning: {
      effort: "high"
    },
    store: true
  }
});

type WorkflowInput = { input_as_text: string };


// Main code entrypoint
export const runWorkflow = async (workflow: WorkflowInput) => {
  return await withTrace("New agent", async () => {
    const state = {

    };
    const conversationHistory: AgentInputItem[] = [
      { role: "user", content: [{ type: "input_text", text: workflow.input_as_text }] }
    ];
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: "agent-builder",
        workflow_id: "wf_696ff70676dc8190a2208f4d9e0ca7b9002dfce20e726753"
      }
    });
    const webResearchAgentResultTemp = await runner.run(
      webResearchAgent,
      [
        ...conversationHistory
      ]
    );
    conversationHistory.push(...webResearchAgentResultTemp.newItems.map((item: any) => item.rawItem));

    if (!webResearchAgentResultTemp.finalOutput) {
        throw new Error("Agent result is undefined");
    }

    const webResearchAgentResult = {
      output_text: JSON.stringify(webResearchAgentResultTemp.finalOutput),
      output_parsed: webResearchAgentResultTemp.finalOutput
    };
    return webResearchAgentResult;
  });
}
