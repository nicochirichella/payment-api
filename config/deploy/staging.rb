ec2_role :api
set :stage, 'staging'
set :docker_extra_options, '--restart=unless-stopped'

set :ssh_options, {
  user: 'deploy',
  keys: %w(/var/lib/jenkins/.ssh/deploy_keys/id_rsa),
  forward_agent: true,
  auth_methods: %w(publickey)
}
