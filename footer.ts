       {/* Footer */}
          <Box component="footer" sx={{ position: 'fixed', minHeight: 48, py: 0.5, borderTop: 1, borderColor: 'grey.700', bgcolor: 'grey.900', mt: 'auto', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {/* Left corner: logo and created by */}
            <Box sx={{ position: 'absolute', left: 16, bottom: 8, display: 'flex', alignItems: 'center', gap: 1 }}>
              <img src="icon.png" alt="App Icon" style={{ width: 32, height: 32, borderRadius: 6, marginRight: 8 }} />
              <Typography color="cyan.300" fontSize={13} fontWeight={600} sx={{ mr: 1 }}>
                Created by <a href="https://github.com/involvex" target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee', textDecoration: 'underline' }}>Ina Venox</a>
              </Typography>
            </Box>
            {/* Center: links and quote */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
              <Box display="flex" gap={2} alignItems="center" justifyContent="center" mt={0.5}>
                <a href="https://newworldchat.ai" target="_blank" rel="noopener noreferrer" style={{ color: '#22d3ee', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: 4 }}><span role="img" aria-label="homepage">🌐</span> Homepage</a>
                <a href="https://www.buymeacoffee.com/involvex" target="_blank" rel="noopener noreferrer" style={{ color: '#fde68a', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: 4 }}><span role="img" aria-label="coffee">☕</span> Buy me a coffee</a>
                <a href="https://github.com/involvex/new-world-chat-ai" target="_blank" rel="noopener noreferrer" style={{ color: '#f472b6', textDecoration: 'underline', display: 'flex', alignItems: 'center', gap: 4 }}><span role="img" aria-label="github">🐙</span> GitHub</a>
          </Box>