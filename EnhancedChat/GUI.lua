GUI.isVisible = true
GUI.showSettings = false
GUI.chatMessages = {}
GUI.inputText = ""
GUI.scrollToBottom = false
GUI.initialized = false
GUI.lastSendTime = 0
GUI.isSending = false
GUI.chatToggleFeature = nil

GUI.windowWidth = 600
GUI.windowHeight = 400
GUI.maxMessages = 100

local Service = nil

function GUI.SetService(service)
    Service = service
end

function GUI.ShowToast(sender, message, duration)
    duration = duration or 3000
    
    pcall(function()
        local title = tostring(sender)
        local text = tostring(message)
        GUI.AddToast(title, text, duration, eToastPos.TOP_RIGHT)
        print("[TOAST] [" .. title .. "] " .. text)
    end)
end

function GUI.Initialize()
    if GUI.initialized then
        return
    end
    
    pcall(function()
        if Service then
            local sessionId = Service.GetSessionId()
            local rockstarId = Service.GetRockstarId()
            
            GUI.sessionId = sessionId
            GUI.rockstarId = rockstarId
            
            Service.SendToServer(sessionId, rockstarId)
            
            print("Enhanced Chat")
            print("Session ID: " .. tostring(sessionId))
            print("Rockstar ID: " .. tostring(rockstarId))

        else
            GUI.AddMessage("System", "Service not available")
        end
    end)

    GUI.initialized = true
end

function GUI.AddMessage(sender, message)
    pcall(function()
        table.insert(GUI.chatMessages, {
            sender = tostring(sender or "Unknown"),
            message = tostring(message or ""),
            timestamp = os.time()
        })
        
        while #GUI.chatMessages > GUI.maxMessages do
            table.remove(GUI.chatMessages, 1)
        end

        GUI.scrollToBottom = true
    end)
end

function GUI.RenderChatHistory()
    local success = pcall(function()
        local availWidth, availHeight = ImGui.GetContentRegionAvail()
        local chatHeight = math.max(availHeight - 60, 100)
        
        if ImGui.BeginChild("ChatHistory", 0, chatHeight, true) then
            for i, msg in ipairs(GUI.chatMessages) do
                local timeStr = os.date("%H:%M:%S", msg.timestamp)
                
                local r, g, b = 0, 150, 255
                ImGui.TextColored(r, g, b, 255, string.format("[%s] %s:", timeStr, msg.sender))
                ImGui.SameLine()
                ImGui.Text(msg.message)
                
                ImGui.Spacing()
            end
            
            if GUI.scrollToBottom then
                ImGui.SetScrollHereY(1.0)
                GUI.scrollToBottom = false
            end
            
            ImGui.EndChild()
        end
    end)
    
    if not success then
        GUI.AddMessage("Error", "Rendering error in chat history")
    end
end

function GUI.RenderChatInput()
    pcall(function()
        local availWidth = ImGui.GetContentRegionAvail()
        
        ImGui.PushItemWidth(availWidth - 90)
        
        local newText = ImGui.InputTextWithHint(
            "##ChatInput",
            "Enter message...",
            GUI.inputText,
            0
        )
        
        GUI.inputText = newText or GUI.inputText
        ImGui.PopItemWidth()
        ImGui.SameLine()
        
        local buttonPressed = ImGui.Button("Send", 80, 0)
        
        local currentTime = Time.GetEpocheMs()
        local timeSinceLastSend = currentTime - GUI.lastSendTime
        
        if buttonPressed and not GUI.isSending and timeSinceLastSend > 500 then
            local trimmedText = GUI.inputText:match("^%s*(.-)%s*$")
            
            if trimmedText and trimmedText ~= "" then
                GUI.isSending = true
                
                if Service then
                    Service.SendChatMessage(trimmedText)
                    GUI.AddMessage(GUI.rockstarId or "You", trimmedText)
                end
                
                GUI.inputText = ""
                GUI.lastSendTime = currentTime
                
                Script.QueueJob(function()
                    Script.Yield(500)
                    GUI.isSending = false
                end)
            end
        end
    end)
end

function GUI.Render()
    if not GUI.initialized then
        GUI.Initialize()
    end
    
    if not GUI.isVisible then
        return
    end
    
    local success = pcall(function()
        local sessionId = Service.GetSessionId()
        
        ImGui.SetNextWindowSize(GUI.windowWidth, GUI.windowHeight, 2)
        local open, shouldShow = ImGui.Begin("Enhanced Chat", true, 32)
        
        if not shouldShow then
            GUI.isVisible = false
            if Service then
                Service.Disconnect()
            end
            if GUI.chatToggleFeature then
                GUI.chatToggleFeature:SetValue(false)
            end
        end
        
        if open then
            if ImGui.Button("Settings", 100, 0) then
                GUI.showSettings = not GUI.showSettings
            end
            
            ImGui.SameLine()
            
            if ImGui.Button("Copy Session ID", 120, 0) then
                if GUI.sessionId then
                    ImGui.SetClipboardText(tostring(GUI.sessionId))
                    print("[Enhanced Chat] Session ID copied to clipboard: " .. tostring(GUI.sessionId))
                end
            end
            
            ImGui.SameLine()
            
            if ImGui.Button("Clear Chat", 90, 0) then
                GUI.chatMessages = {}
                print("[Enhanced Chat] Chat history cleared")
            end
            
            ImGui.Separator()
            ImGui.Spacing()
            
            GUI.RenderChatHistory()
            
            ImGui.Spacing()
            ImGui.Separator()
            
            GUI.RenderChatInput()
            
            ImGui.End()
        end
    end)
    
    if not success then
        GUI.isVisible = false
    end
end

function GUI.Toggle()
    GUI.isVisible = not GUI.isVisible
end

function GUI.UpdateMessages(messages)
    if messages then
        for _, msg in ipairs(messages) do
            GUI.AddMessage(msg.sender or "Unknown", msg.message or "")
        end
    end
end

return GUI