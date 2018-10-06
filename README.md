# AWS MFA Credentials Helper

[ ![Codeship Status for zommarin/aws-mfa-util](https://app.codeship.com/projects/b93ec9a0-ab89-0136-b59c-565b68d8494a/status?branch=master)](https://app.codeship.com/projects/309289)

A utility that implements MFA (Multi Factor Authentication, e.g. the Google Authenticator) support for the AWS CLI as well as applications using AWS APIs. It's purpose is similar to [Limes](https://github.com/otm/limes), but it works purely by manipulating the `~/.aws/credentials` file (Limes works by emulating the AWS metadata API).

## Installation

### From npm (recommended)

You need to have [Node.js](https://nodejs.org/en/) (and `npm` which is bundled) installed (which optionally can be done using [NVM](https://github.com/creationix/nvm/blob/master/README.md)).

Install the package globally using `npm`:

```bash
npm install -g @zommarin/aws-mfa-util
```

The command should now be available as:

```bash
aws-mfa-util --help
```

## Configuration

The utility works using the settings in the `~/.aws/credentials` file. It needs to profiles (i.e sections in the file):

* One that has the account credentials to which an MFA is associated. \
  This section has to exists before running the command.
* One that contains the temporary token. \
  This token is given by AWS as a result of presenting a valid MFA generated code.

An example:

```
[default]
aws_access_key_id=BCTUMHTXNZKSRT8RDLEK
aws_secret_access_key=LDp2llJ7R2Mwc9IpqWZbhahxcZN3nmwpq92
mfa_serial=arn:aws:iam::6372819375:mfa/joe@doe.com

[mfa]
region=eu-west-1
```

The `[default]` section contains the access key and token for the account (as created in the AWS IAM WebUI). Here also the ARN of the MFA device is stated.

Optionally the target section is already present before running the `aws-mfa-util` where extra configuration can be given (in this case the default region).


## Usage

Given the configuration file above you can use your MFA to generate a code, e.g. `123456`, and generate credentials in the target section:

```bash
aws-mfa-util -c 123456
```

Which would update the file with credentials in the `[mfa]` section:

```
[default]
aws_access_key_id=BCTUMHTXNZKSRT8RDLEK
aws_secret_access_key=LDp2llJ7R2Mwc9IpqWZbhahxcZN3nmwpq92
mfa_serial=arn:aws:iam::6372819375:mfa/joe@doe.com

[mfa]
region=eu-west-1
aws_access_key_id=WeXC/Z7SPjY/CXGpeQ8Nng
aws_secret_access_key=74vPyestExgdvEmBU+BJfevj3sTaC0RzDRALuhhR
aws_session_token=BNI29w/e1Rh1Um2s/4De++6PNrZ+Gcrnl+s/wPkL2NgfKbD8I08qcsycbfQknWOqkH7f9OqaqExWOsM6f9FB2fqRtzYkXCnjl4k6Ay8q5fYQnsASJciRcqhb0KUFZZERWishybaNpud7gjMTt+QCDFczyL4tRPs+30rVsIrIDiWtjYaZB2Y
region=eu-west-1
expires=2018-10-05T14:48:16.000Z
```

Now AWS CLI commands as well as AWS API based programs can use the credentials by setting the `AWS_PROFILE` environment variable:

```bash
export AWS_PROFILE=mfa
```

### Usage with Roles

If [IAM Roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles.html) are used, then they may simply use the MFA created profile by adding the following to the `~/.aws/credentials` file:

```
[my-role-a]
region=eu-west-1
role_arn=arn:aws:iam::6372819375:role/TheRoleA
source_profile=mfa

[my-role-b]
region=eu-west-1
role_arn=arn:aws:iam::6372819375:role/TheRoleB
source_profile=mfa
```

This way the MFA login may be re-used by the different roles simply by exporting the needed `AWS_PROFILE` variable:

```
# Select the TheRoleB role
export AWS_PROFILE=my-role-b
```