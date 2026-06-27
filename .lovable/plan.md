## Plan

1. **Confirm the current issue in the UI**
   - The workspace still has daily credits available, but the latest app AI Gateway request failed with HTTP 402.
   - I’ll keep the UI behavior clear when that happens instead of leaving users thinking search is stuck.

2. **Lower AI Gateway spend per search**
   - Switch the chat route from the current default model to a cheaper flash-lite model for contact research.
   - Tighten the system prompt so it uses fewer tool loops where possible while keeping LinkedIn/profile-picture/contact-form requirements.
   - Reduce oversized scrape payloads so fewer tokens are sent back into the model.

3. **Add a non-AI fallback when AI credits fail**
   - If the AI Gateway returns a 402 credit error, the server will return a clear “credits unavailable” assistant response instead of a broken stream.
   - The fallback response will preserve the user’s query and explain the search could not run, so the chat/thread still updates normally.

4. **Improve client-side recovery**
   - Ensure failed submissions still create/update the thread so new chats don’t appear frozen.
   - Keep the search indicator while active, then remove it and show only the final message/error.

5. **Validate**
   - Check the latest AI Gateway logs after a test request to confirm whether requests are cheaper or whether the failure is still a workspace-level 402.
   - Verify new chat creation and a failed search both visibly update the screen.

## Important limitation
I can reduce usage and make failures graceful, but I cannot make Lovable AI Gateway unlimited from code. If the gateway blocks requests due to workspace billing/allowance, only workspace credits or a different user-provided backend/search provider can remove that hard limit.