local Service = {}

Service.serverUrl = "http://localhost:3000"
Service.sessionId = nil
Service.rockstarId = nil
Service.lastPollTime = 0
Service.pollInterval = 1000
Service.lastSessionHash = nil

function Service.GetSessionId()
    local success, result = pcall(function()
        local playerIds = {}
        
        if NETWORK and NETWORK.NETWORK_GET_NUM_CONNECTED_PLAYERS then
            local numPlayers = NETWORK.NETWORK_GET_NUM_CONNECTED_PLAYERS() or 0
            
            for i = 0, 31 do
                if PLAYER.GET_PLAYER_PED(i) ~= 0 then
                    local playerName = PLAYER.GET_PLAYER_NAME(i)
                    if playerName and playerName ~= "" and playerName ~= "**Invalid**" then
                        table.insert(playerIds, playerName)
                    end
                end
            end
            
            if #playerIds > 0 then
                table.sort(playerIds)
                local combined = table.concat(playerIds, "_")
                local hash = 0
                for i = 1, math.min(#combined, 100) do
                    hash = (hash * 31 + string.byte(combined, i)) % 2147483647
                end
                
                if Service.lastSessionHash ~= hash then
                    Service.sessionId = nil
                    Service.lastSessionHash = hash
                    print("[Service] Lobby changed - new session ID: lobby_" .. tostring(hash))
                end
                
                if Service.sessionId then
                    return Service.sessionId
                end
                
                Service.sessionId = "lobby_" .. tostring(hash)
                return Service.sessionId
            end
        end
        
        local timestamp = Time.GetEpocheMs() or os.time()
        Service.sessionId = "solo_" .. tostring(timestamp)
        return Service.sessionId
    end)
    
    if success then
        return result
    end
    
    Service.sessionId = "error_" .. tostring(Time.GetEpocheMs() or os.time())
    return Service.sessionId
end

function Service.GetRockstarId()
    if Service.rockstarId and Service.rockstarId ~= "0" and Service.rockstarId ~= "Player0" then
        return Service.rockstarId
    end
    
    local success, result = pcall(function()
        local playerId = PLAYER.PLAYER_ID()
        
        if playerId and playerId >= 0 then
            local playerName = PLAYER.GET_PLAYER_NAME(playerId)
            
            if playerName and playerName ~= "" and playerName ~= "**Invalid**" then
                return playerName
            end
            
            return "Player" .. tostring(playerId)
        end
        
        return "Player0"
    end)
    
    if success and result then
        Service.rockstarId = result
        return result
    end
    
    return "Player0"
end

function Service.SendToServer(sessionId, rockstarId)
    local success, error = pcall(function()
        local curl = Curl.Easy()
        
        local payload = string.format(
            '{"sessionId":"%s","rockstarId":"%s","action":"connect"}',
            tostring(sessionId or "unknown"),
            tostring(rockstarId or "0")
        )
        
        local url = Service.serverUrl .. "/api/chat/connect"
        
        curl:Setopt(eCurlOption.CURLOPT_URL, url)
        curl:Setopt(eCurlOption.CURLOPT_POST, 1)
        curl:Setopt(eCurlOption.CURLOPT_POSTFIELDS, payload)
        curl:AddHeader("Content-Type: application/json")
        
        local performSuccess = curl:Perform()
        print("Request sent, Status: " .. tostring(performSuccess))
    end)
end

function Service.SendChatMessage(message)
    if not message or message == "" then
        return
    end
    
    local success, error = pcall(function()
        local sessionId = Service.GetSessionId()
        local rockstarId = Service.GetRockstarId()
        
        local curl = Curl.Easy()
        
        local safeMessage = message:gsub('"', '\\"'):gsub('\n', '\\n')
        
        local payload = string.format(
            '{"sessionId":"%s","rockstarId":"%s","message":"%s","action":"message"}',
            tostring(sessionId),
            tostring(rockstarId),
            safeMessage
        )
        
        local url = Service.serverUrl .. "/api/chat/send"
        
        curl:Setopt(eCurlOption.CURLOPT_URL, url)
        curl:Setopt(eCurlOption.CURLOPT_POST, 1)
        curl:Setopt(eCurlOption.CURLOPT_POSTFIELDS, payload)
        curl:AddHeader("Content-Type: application/json")
        
        local performSuccess = curl:Perform()
    end)
end

function Service.Disconnect()
    local success, error = pcall(function()
        local sessionId = Service.GetSessionId()
        local rockstarId = Service.GetRockstarId()
        
        local curl = Curl.Easy()
        
        local payload = string.format(
            '{"sessionId":"%s","rockstarId":"%s"}',
            tostring(sessionId),
            tostring(rockstarId)
        )
        
        local url = Service.serverUrl .. "/api/chat/disconnect"
        
        curl:Setopt(eCurlOption.CURLOPT_URL, url)
        curl:Setopt(eCurlOption.CURLOPT_POST, 1)
        curl:Setopt(eCurlOption.CURLOPT_POSTFIELDS, payload)
        curl:AddHeader("Content-Type: application/json")
        
        curl:Perform()
        print("[Service] Disconnected from session")
    end)
end

Service.pollingInProgress = false
Service.pendingMessages = {}
Service.lastMessageCount = 0
Service.currentSessionId = nil
Service.firstPollDone = false

function Service.PollMessages()
    local currentTime = Time.GetEpocheMs()
    
    if currentTime - Service.lastPollTime < Service.pollInterval then
        return nil
    end
    
    Service.lastPollTime = currentTime
    
    if Service.pollingInProgress then
        return nil
    end
    
    Service.pollingInProgress = true
    
    Script.QueueJob(function()
        local success, result = pcall(function()
            local sessionId = Service.GetSessionId()
            local rockstarId = Service.GetRockstarId()

            if Service.currentSessionId ~= sessionId then
                Service.currentSessionId = sessionId
                Service.lastMessageCount = 0
                Service.pendingMessages = {}
                Service.firstPollDone = false
            end
            
            local curl = Curl.Easy()
            
            local url = string.format(
                "%s/api/chat/poll?sessionId=%s&rockstarId=%s",
                Service.serverUrl,
                tostring(sessionId),
                tostring(rockstarId)
            )
            
            -- print("Polling: " .. url)
            
            curl:Setopt(eCurlOption.CURLOPT_URL, url)
            
            curl:Perform()
            
            local waited = 0
            while not curl:GetFinished() and waited < 50 do
                Script.Yield(100)
                waited = waited + 1
            end
            
            if curl:GetFinished() then
                local code, response = curl:GetResponse()
                
                if response then
                    if code == 0 and response ~= "" then
                        local msgs = {}
                        local myRockstarId = Service.GetRockstarId()
                        
                        for sender, message in response:gmatch('"sender":"([^"]+)","message":"([^"]+)"') do
                            table.insert(msgs, {
                                sender = sender,
                                message = message
                            })
                        end
                        
                        -- Wenn der Server-Verlauf zurückgesetzt wurde (z.B. Clear), zähle erneut ab 0
                        if #msgs < Service.lastMessageCount then
                            Service.lastMessageCount = 0
                        end

                        if #msgs > Service.lastMessageCount then
                            local newMsgs = {}
                            for i = Service.lastMessageCount + 1, #msgs do
                                local msg = msgs[i]
                                if msg.sender ~= myRockstarId then
                                    table.insert(newMsgs, msg)
                                    print("✓ New message: [" .. msg.sender .. "] " .. msg.message)
                                end
                            end
                            
                            Service.lastMessageCount = #msgs
                            
                            if #newMsgs > 0 then
                                -- Markiere Messages als "showToast" nur wenn es nicht der erste Poll ist
                                for _, msg in ipairs(newMsgs) do
                                    msg.showToast = Service.firstPollDone
                                end
                                Service.pendingMessages = newMsgs
                                print("→ " .. #newMsgs .. " new messages from other players received")
                            end
                            
                            Service.firstPollDone = true
                        end
                    end
                end
            else
                print("Poll Timeout")
            end
        end)
        
        if not success then
            print("Poll Error: " .. tostring(result))
        end
        
        Service.pollingInProgress = false
    end)
    
    if #Service.pendingMessages > 0 then
        local msgs = Service.pendingMessages
        Service.pendingMessages = {}
        return msgs
    end
    
    return nil
end

return Service
