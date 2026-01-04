GUI.isVisible = true
GUI.showSettings = false
GUI.chatMessages = {}
GUI.inputText = ""
GUI.scrollToBottom = false
GUI.autoScroll = true
GUI.initialized = false
GUI.lastSendTime = 0
GUI.isSending = false
GUI.chatToggleFeature = nil
GUI.connectedClients = {}
GUI.lastClientUpdate = 0
GUI.showSidebar = true

GUI.windowWidth = 1000
GUI.windowHeight = 800
GUI.maxMessages = 50

local Service = nil
local Settings = nil

function GUI.SetService(service)
    Service = service
end

function GUI.SetSettings(settings)
    Settings = settings
    if Settings and Settings.settings then
        GUI.autoScroll = Settings.settings.autoScroll or true
    end
end

function GUI.ShowToast(sender, message, duration)
    duration = duration or 3000
    
    pcall(function()
        local title = tostring(sender)
        local text = tostring(message)
        GUI.AddToast(title, text, duration, eToastPos.TOP_RIGHT)
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
                
                if msg.sender == "System" then
                    local r, g, b = 100, 100, 0
                    ImGui.TextColored(r, g, b, 255, string.format("[%s] %s", timeStr, msg.message))
                else 
                    local r, g, b = 0, 150, 255
                    ImGui.TextColored(r, g, b, 255, string.format("[%s] %s:", timeStr, msg.sender))
                    ImGui.SameLine()
                    ImGui.Text(msg.message)
                end
                
                ImGui.Spacing()
            end
            
            if GUI.autoScroll and GUI.scrollToBottom then
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
        
        ImGui.PushItemWidth(availWidth - 180)
        
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

        ImGui.SameLine()

        if ImGui.Button("Clear", 80, 0) then
            GUI.chatMessages = {}
            GUI.AddMessage("System", "Chat history cleared")
            print("[Enhanced Chat] Chat history cleared")
        end

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
        local open, shouldShow = ImGui.Begin("Enhanced Chat (" .. tostring(sessionId or "unknown session") .. ")", true, 32)
        
        if not shouldShow then
            GUI.isVisible = false
            if GUI.chatToggleFeature then
                GUI.chatToggleFeature:SetValue(false)
            end
        end
        
        if open then
            if ImGui.Button("Settings", 100, 0) then
                GUI.showSettings = not GUI.showSettings
            end
            
            local showUserList = Settings and Settings.settings.showUserList or false
            
            if showUserList then
                if ImGui.BeginChild("UserList", 200, 0, true) then
                    ImGui.Text("Users in Session")
                    ImGui.Separator()
                    ImGui.Spacing()
                    
                    if #GUI.connectedClients > 0 then
                        for _, client in ipairs(GUI.connectedClients) do
                            local r, g, b = 0, 200, 100
                            ImGui.TextColored(r, g, b, 255, client.rockstarId or "Unknown")
                            ImGui.Spacing()
                        end
                    else
                        ImGui.TextDisabled("No users connected")
                    end
                    
                    ImGui.EndChild()
                end
                ImGui.SameLine()
            end

            if ImGui.BeginChild("ChatArea", 0, 0, false) then
                GUI.RenderChatHistory()
            
                ImGui.Spacing()
                GUI.RenderChatInput()
                
                ImGui.EndChild()
            end
            
            ImGui.End()
            
            -- Update connected clients list
            if Service then
                GUI.UpdateConnectedClients()
            end
        end
        
        -- Render Settings Window
        pcall(function()
            if GUI.showSettings and Settings and Settings.Render then
                Settings.Render()
            end
        end)
    end)
    
    if not success then
        GUI.isVisible = false
    end
end

function GUI.Toggle()
    GUI.isVisible = not GUI.isVisible
end

function GUI.UpdateConnectedClients()
    local currentTime = Time.GetEpocheMs()
    if currentTime - GUI.lastClientUpdate < 3000 then
        return
    end
    GUI.lastClientUpdate = currentTime
    
    Script.QueueJob(function()
        pcall(function()
            local curl = Curl.Easy()
            local url = Service.serverUrl .. "/api/sessions"
            
            curl:Setopt(eCurlOption.CURLOPT_URL, url)
            curl:Perform()
            
            local waited = 0
            while not curl:GetFinished() and waited < 30 do
                Script.Yield(100)
                waited = waited + 1
            end
            
            if curl:GetFinished() then
                local code, response = curl:GetResponse()
                if code == 0 and response then
                    pcall(function()
                        local mySessionId = Service.connectedSessionId or Service.GetSessionId()
                        GUI.connectedClients = {}
                        
                        local sessionPattern = '"sessionId":"([^"]+)"[^}]*"rockstarIds"%s*:%s*(%[.-]),'
                        for sessionId, rockstarIdsStr in response:gmatch(sessionPattern) do
                            if sessionId == mySessionId then
                                for rockstarId in rockstarIdsStr:gmatch('"([^"]+)"') do
                                    table.insert(GUI.connectedClients, {
                                        sessionId = sessionId,
                                        rockstarId = rockstarId
                                    })
                                end
                            end
                        end
                    end)
                end
            end
        end)
    end)
end

function GUI.UpdateMessages(messages)
    if messages then
        for _, msg in ipairs(messages) do
            GUI.AddMessage(msg.sender or "Unknown", msg.message or "")
        end
    end
end

return GUI