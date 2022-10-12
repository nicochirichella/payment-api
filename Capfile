# Load DSL and set up stages
# https://github.com/capistrano/capistrano/issues/722#issuecomment-30885050
require 'capistrano/setup'
require 'capistrano/install'
require 'capistrano/framework'

require "cap-ec2/capistrano"

# Load custom tasks from `lib/capistrano/tasks` if you have any defined
Dir.glob('lib/capistrano/tasks/*.rake').each { |r| import r }
